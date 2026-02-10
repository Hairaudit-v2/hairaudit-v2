import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";
import { runAIAudit } from "@/lib/ai/audit";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

// Minimal required categories for “submit”
const REQUIRED_CATS = ["preop_front", "preop_sides", "donor_rear"] as const;

function parseUploadCategory(type: string): string | null {
  const prefix = "patient_photo:";
  if (!type?.startsWith(prefix)) return null;
  return type.slice(prefix.length);
}

function isImageUpload(type: string): boolean {
  const t = String(type ?? "").toLowerCase();
  return t.includes("image") || t.includes("photo") || t.includes("jpg") || t.includes("png") || t.includes("jpeg") || t.includes("webp");
}

export const runAudit = inngest.createFunction(
  { id: "run-audit" },
  { event: "case/submitted" },
  async ({ event, step, logger }) => {
    const { caseId, userId } = event.data as { caseId: string; userId: string };

    const supabase = supabaseAdmin();

    // 1) Load case
    const c = await step.run("load-case", async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, user_id, status, submitted_at")
        .eq("id", caseId)
        .maybeSingle();

      if (error) throw new Error(`cases load failed: ${error.message}`);
      if (!data) throw new Error("Case not found");
      if (data.user_id !== userId) throw new Error("Forbidden: not owner");
      return data;
    });

    // 2) Mark processing (optional but helpful)
    await step.run("mark-processing", async () => {
      const { error } = await supabase
        .from("cases")
        .update({ status: "processing" })
        .eq("id", caseId);

      if (error) throw new Error(`cases update failed: ${error.message}`);
    });

    // 3) Verify uploads
    const uploads = await step.run("load-uploads", async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("id, type, storage_path, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(`uploads load failed: ${error.message}`);
      return data ?? [];
    });

    const catCounts: Record<string, number> = {};
    for (const u of uploads) {
      const cat = parseUploadCategory(u.type);
      if (!cat) continue;
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }

    const missing = REQUIRED_CATS.filter((cat) => (catCounts[cat] ?? 0) === 0);
    if (missing.length) {
      // Mark case “needs_more_info” or revert to draft
      await step.run("mark-missing", async () => {
        await supabase
          .from("cases")
          .update({ status: "draft" })
          .eq("id", caseId);
      });
      throw new Error(`Missing required photo categories: ${missing.join(", ")}`);
    }

    // 4) Load existing report summary (patient/doctor/clinic answers)
    const existingSummary = await step.run("load-report-summary", async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, summary")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(`reports load failed: ${error.message}`);
      const s = (data?.summary ?? {}) as Record<string, unknown>;
      return {
        patient_answers: s.patient_answers ?? null,
        doctor_answers: s.doctor_answers ?? null,
        clinic_answers: s.clinic_answers ?? null,
      };
    });

    // 5) Get signed URLs for images (for AI vision)
    const imageUrls = await step.run("get-signed-image-urls", async () => {
      const imageUploads = uploads.filter((u) => isImageUpload(u.type));
      const urls: string[] = [];
      for (const u of imageUploads.slice(0, 10)) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(u.storage_path, 60 * 15);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      return urls;
    });

    // 6) Run AI audit (answers + images)
    const aiResult = await step.run("run-ai-audit", async () => {
      return await runAIAudit({
        patient_answers: existingSummary.patient_answers as Record<string, unknown> | null,
        doctor_answers: existingSummary.doctor_answers as Record<string, unknown> | null,
        clinic_answers: existingSummary.clinic_answers as Record<string, unknown> | null,
        imageUrls,
      });
    });

    // 7) Determine report version
    const nextVersion = await step.run("next-version", async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("version")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1);

      if (error) throw new Error(`reports load failed: ${error.message}`);
      const latest = data?.[0]?.version ?? 0;
      return Number(latest) + 1;
    });

    // 8) Create PDF (includes AI audit results)
    const pdfBuffer = await step.run("build-pdf", async () => {
      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      const chunks: Buffer[] = [];
      doc.on("data", (d: any) => chunks.push(Buffer.from(d)));
      const done = new Promise<Buffer>((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      doc.fontSize(20).text("HairAudit Report", { align: "left" });
      doc.moveDown();
      doc.fontSize(12).text(`Case ID: ${caseId}`);
      doc.text(`Version: v${nextVersion}`);
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      doc.fontSize(14).text("AI Audit Summary", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Overall Score: ${aiResult.score}/100`);
      doc.text(`Donor Quality: ${aiResult.donor_quality}`);
      doc.text(`Graft Survival Estimate: ${aiResult.graft_survival_estimate}`);
      doc.moveDown();
      doc.text("Notes:", { continued: false });
      doc.text(aiResult.notes || "—", { align: "left" });
      if (aiResult.findings?.length) {
        doc.moveDown();
        doc.text("Key Findings:");
        aiResult.findings.forEach((f) => doc.text(`  • ${f}`, { indent: 20 }));
      }
      doc.moveDown();

      doc.fontSize(12).text(`Uploads: ${uploads.length} | Model: ${aiResult.model}`);
      doc.end();

      return await done;
    });

    // 9) Upload PDF
    const pdfPath = `${caseId}/v${nextVersion}.pdf`;

    await step.run("upload-pdf", async () => {
      // Inngest may serialize Buffer; ensure we pass a real Buffer
      const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from((pdfBuffer as { data?: number[] }).data ?? []);
      const { error } = await supabase.storage.from(BUCKET).upload(pdfPath, buf, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (error) throw new Error(`storage upload failed: ${error.message}`);
    });

    // 10) Insert report row (with AI audit + answers)
    await step.run("insert-report-row", async () => {
      const summary = {
        ...existingSummary,
        score: aiResult.score,
        donor_quality: aiResult.donor_quality,
        graft_survival_estimate: aiResult.graft_survival_estimate,
        notes: aiResult.notes,
        findings: aiResult.findings,
        ai_audit: {
          model: aiResult.model,
          generated_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase.from("reports").insert({
        case_id: caseId,
        version: nextVersion,
        pdf_path: pdfPath,
        summary,
      });

      if (error) throw new Error(`reports insert failed: ${error.message}`);
    });

    // 11) Mark case complete
    await step.run("mark-complete", async () => {
      const { error } = await supabase
        .from("cases")
        .update({ status: "complete" })
        .eq("id", caseId);

      if (error) throw new Error(`cases complete update failed: ${error.message}`);
    });

    logger.info("Audit pipeline complete", { caseId, nextVersion, pdfPath });
    return { ok: true, version: nextVersion, pdfPath };
  }
);
