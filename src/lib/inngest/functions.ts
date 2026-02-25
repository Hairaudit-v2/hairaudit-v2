import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";
import { runAIAudit } from "@/lib/ai/audit";
import { notifyPatientAuditFailed, notifyAuditorAuditFailed } from "@/lib/email";
import { canSubmit } from "@/lib/auditPhotoSchemas";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

// Minimal required categories for “submit”
function isImageUpload(type: string): boolean {
  const t = String(type ?? "").toLowerCase();
  return t.includes("image") || t.includes("photo") || t.includes("jpg") || t.includes("png") || t.includes("jpeg") || t.includes("webp");
}

export const runAudit = inngest.createFunction(
  {
    id: "run-audit",
    retries: 3,
    onFailure: async ({ error, event: failureEvent, step }) => {
      const originalEvent = (failureEvent as { data?: { event?: { data?: unknown } } }).data?.event;
      const { caseId, userId } = (originalEvent?.data ?? {}) as { caseId?: string; userId?: string };
      if (!caseId || !userId) {
        console.error("[runAudit onFailure] Missing caseId/userId in event", failureEvent);
        return;
      }

      const supabase = supabaseAdmin();
      const errMsg = error?.message ?? String(error);

      await step.run("mark-audit-failed", async () => {
        await supabase
          .from("cases")
          .update({ status: "audit_failed" })
          .eq("id", caseId);
      });

      await step.run("upsert-failed-report", async () => {
        const { data: existing } = await supabase
          .from("reports")
          .select("id, version")
          .eq("case_id", caseId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersion = (existing?.version ?? 0) + 1;
        if (existing) {
          await supabase
            .from("reports")
            .update({ status: "failed", error: errMsg })
            .eq("id", existing.id);
        } else {
          await supabase.from("reports").insert({
            case_id: caseId,
            version: nextVersion,
            status: "failed",
            error: errMsg,
            pdf_path: "",
            summary: {},
          });
        }
      });

      await step.run("notify-patient", async () => {
        const { data: user } = await supabase.auth.admin.getUserById(userId);
        const email = user?.user?.email;
        if (email) await notifyPatientAuditFailed(caseId, email, errMsg);
      });

      await step.run("notify-auditor", async () => {
        await notifyAuditorAuditFailed(caseId, errMsg);
      });
    },
  },
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

    const patientPhotos = uploads.filter((u) => String(u.type ?? "").startsWith("patient_photo:"));
    if (!canSubmit("patient", patientPhotos.map((u) => ({ type: u.type })))) {
      // Mark case “needs_more_info” or revert to draft
      await step.run("mark-missing", async () => {
        await supabase
          .from("cases")
          .update({ status: "draft" })
          .eq("id", caseId);
      });
      throw new Error("Missing required patient photos (Current Front, Top, Donor rear)");
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

    // 8) Create PDF (includes AI audit results + case photos)
    const pdfBuffer = await step.run("build-pdf", async () => {
      const { buildAuditReportPdf, fetchReportImages } = await import("@/lib/pdf/reportBuilder");
      const images = await fetchReportImages(supabase, BUCKET, uploads);
      return buildAuditReportPdf({
        caseId,
        version: nextVersion,
        generatedAt: new Date().toLocaleString(),
        score: aiResult.score,
        donorQuality: aiResult.donor_quality,
        graftSurvival: aiResult.graft_survival_estimate,
        notes: aiResult.notes || undefined,
        findings: aiResult.findings,
        model: aiResult.model,
        uploadCount: uploads.length,
        confidencePanel: {
          photoCount: uploads.length,
          missingCategories: aiResult.data_quality?.missing_photos ?? [],
          confidenceScore: aiResult.confidence,
          confidenceLabel: aiResult.confidence_label,
          limitations: aiResult.data_quality?.limitations ?? [],
        },
        radar: {
          section_scores: aiResult.section_scores as unknown as Record<string, number>,
          overall_score: aiResult.overall_score,
          confidence: aiResult.confidence,
        },
        areaScores: {
          domains: {
            donor_management: aiResult.section_scores.donor_management,
            extraction_quality: aiResult.section_scores.extraction_quality,
            graft_handling: aiResult.section_scores.graft_handling_and_viability,
            recipient_implantation: aiResult.section_scores.recipient_placement,
            safety_documentation_aftercare: aiResult.section_scores.post_op_course_and_aftercare,
          },
          sections: aiResult.section_scores,
        },
        images,
      });
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
        // Store the full forensic audit payload for downstream UI + analytics
        forensic_audit: {
          overall_score: aiResult.overall_score,
          confidence: aiResult.confidence,
          confidence_label: aiResult.confidence_label,
          data_quality: aiResult.data_quality,
          section_scores: aiResult.section_scores,
          key_findings: aiResult.key_findings,
          red_flags: aiResult.red_flags,
          photo_observations: aiResult.photo_observations,
          summary: aiResult.summary,
          non_medical_disclaimer: aiResult.non_medical_disclaimer,
          model: aiResult.model,
        },
        area_scores: null,
        section_scores: aiResult.section_scores,
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
        status: "complete",
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
