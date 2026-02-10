import { inngest } from "@/lib/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Buffer } from "buffer";

// Optional: simple PDF generator (Node)
import PDFDocument from "pdfkit";

function makePdfBuffer(input: { caseId: string; version: number; uploads: any[] }) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("HairAudit Report", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Case ID: ${input.caseId}`);
    doc.text(`Version: v${input.version}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(14).text("Uploads summary", { underline: true });
    doc.moveDown(0.5);

    if (input.uploads.length === 0) {
      doc.fontSize(12).text("No uploads found.");
    } else {
      input.uploads.slice(0, 50).forEach((u, i) => {
        doc.fontSize(10).text(
          `${i + 1}. ${u.type}  |  ${u.storage_path}  |  ${new Date(u.created_at).toLocaleString()}`
        );
      });
      if (input.uploads.length > 50) {
        doc.moveDown().fontSize(10).text(`(…and ${input.uploads.length - 50} more)`);
      }
    }

    doc.end();
  });
}

export const caseSubmitted = inngest.createFunction(
  {
    id: "case-submitted-v1",
    retries: 3,
    concurrency: { limit: 10 },
  },
  { event: "case/submitted" },
  async ({ event, step }) => {
    const { caseId, userId } = event.data as { caseId: string; userId: string };

    const supabase = createSupabaseAdminClient();
    const bucket = process.env.CASE_FILES_BUCKET || "case-files";

    // 1) Load & validate case
    const c = await step.run("load case", async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, user_id, status, submitted_at")
        .eq("id", caseId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Case not found");
      if (data.user_id !== userId) throw new Error("User mismatch for case");

      // Defensive: ensure it is submitted
      if (!data.submitted_at && data.status !== "submitted") {
        throw new Error("Case is not submitted; refusing to run audit.");
      }

      return data;
    });

    // 2) Idempotency: find existing latest report (+ any patient_answers from draft)
    const existing = await step.run("check existing reports", async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, version, pdf_path, status, created_at, summary")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1);

      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    });

    // If you want “only one report ever” for v1:
    if (existing?.status === "complete" && existing?.pdf_path) {
      return { ok: true, skipped: true, reason: "report already exists", reportId: existing.id };
    }

    const nextVersion = (existing?.version ?? 0) + 1;

    // 3) Create report row (processing)
    const report = await step.run("create report row", async () => {
      const { data, error } = await supabase
        .from("reports")
        .insert({
          case_id: caseId,
          version: nextVersion,
          status: "processing",
          pdf_path: null,
          error: null,
        })
        .select("id, version")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Failed to create report row");

      return data;
    });

    // 4) Load uploads (photos)
    const uploads = await step.run("load uploads", async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("id, type, storage_path, metadata, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    });

    // 5) Generate PDF (placeholder v1)
    const pdfBuffer = await step.run("generate pdf", async () => {
      return await makePdfBuffer({ caseId, version: report.version, uploads });
    });

    // 6) Upload PDF to storage
    const pdfPath = `cases/${caseId}/reports/v${report.version}.pdf`;

    await step.run("upload pdf to storage", async () => {
      const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from((pdfBuffer as { data?: number[] }).data ?? []);
      const { error } = await supabase.storage.from(bucket).upload(pdfPath, buf, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (error) throw new Error(error.message);
    });

    // 7) Mark report complete (preserve patient_answers from draft if any)
    await step.run("finalize report", async () => {
      const draftSummary = (existing?.summary ?? {}) as Record<string, unknown>;
      const patientAnswers = draftSummary.patient_answers;
      const summary = patientAnswers ? { patient_answers: patientAnswers } : undefined;

      const { error } = await supabase
        .from("reports")
        .update({
          status: "complete",
          pdf_path: pdfPath,
          error: null,
          ...(summary && { summary }),
        })
        .eq("id", report.id);

      if (error) throw new Error(error.message);
    });

    // 8) (Optional) mark case done
    await step.run("update case status", async () => {
      const { error } = await supabase
        .from("cases")
        .update({ status: "complete" }) // or "processing" earlier then "complete"
        .eq("id", caseId);

      if (error) throw new Error(error.message);
    });

    return { ok: true, reportId: report.id, pdfPath };
  }
);
