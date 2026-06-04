/**
 * Stage 7B — Inngest: generate the non-AI Surgery Upload Evidence Review PDF.
 *
 * REGRESSION GUARDS:
 * - Do NOT send `case/submitted` or any event consumed by `runAudit`.
 * - Do NOT call `/api/submit` or mutate `cases.status` / `cases.submitted_at`.
 * - Do NOT invoke `runAIAudit` / forensic PDF pipeline.
 */
import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_SURGERY_UPLOAD_EVIDENCE_REPORT_REQUESTED,
  type SurgeryUploadEvidenceReportRequestedData,
} from "@/lib/inngest/surgeryUploadReportEvents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logEvidenceEvent } from "@/lib/surgeryUpload/logEvidenceEvent";
import { SURGERY_UPLOAD_REPORT_KIND_EVIDENCE_REVIEW_V1 } from "@/lib/surgeryUpload/surgeryUploadReportPipelineStage7a";
import { buildSurgeryEvidenceReviewPdfBuffer } from "@/lib/reports/surgeryUpload/buildSurgeryEvidenceReviewPdf";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import type { SurgerySlotReviewRow } from "@/lib/surgeryUpload/evidenceReview";

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

function supabaseAdmin() {
  return createSupabaseAdminClient();
}

function safeErr(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.trim().slice(0, 500);
}

export const runSurgeryUploadEvidenceReviewReport = inngest.createFunction(
  {
    id: "surgery-upload-evidence-review-report-v1",
    retries: 2,
    concurrency: { key: "event.data.caseId", limit: 1 },
  },
  { event: INNGEST_SURGERY_UPLOAD_EVIDENCE_REPORT_REQUESTED },
  async ({ event, step, logger }) => {
    const data = event.data as SurgeryUploadEvidenceReportRequestedData;
    const caseId = String(data.caseId ?? "");
    const requestedBy = String(data.requestedBy ?? "");
    if (!caseId || !requestedBy) {
      logger.warn("surgery evidence report: missing caseId or requestedBy");
      return { ok: false, reason: "missing_payload" };
    }

    const supabase = supabaseAdmin();

    const claim = await step.run("claim-running", async () => {
      const { data: upd, error } = await supabase
        .from("surgery_upload_details")
        .update({ evidence_report_pipeline_status: "running" })
        .eq("case_id", caseId)
        .eq("evidence_report_pipeline_status", "queued")
        .select("id, evidence_report_pipeline_status, evidence_report_id")
        .maybeSingle();

      if (error) throw new Error(error.message);

      if (upd) {
        return { skipped: false as const };
      }

      const { data: cur } = await supabase
        .from("surgery_upload_details")
        .select("evidence_report_pipeline_status, evidence_report_id")
        .eq("case_id", caseId)
        .maybeSingle();

      if (cur?.evidence_report_pipeline_status === "succeeded" && cur.evidence_report_id) {
        return { skipped: true as const };
      }

      if (cur?.evidence_report_pipeline_status === "queued") {
        throw new Error("RETRY_CLAIM: row still queued");
      }

      throw new Error(`Cannot claim report job (status=${cur?.evidence_report_pipeline_status ?? "none"})`);
    });

    if (claim.skipped) {
      logger.info("surgery evidence report: skipped (already succeeded)", { caseId });
      return { ok: true, skipped: true };
    }

    try {
      await step.run("build-upload-publish", async () => {
        const [{ data: details, error: dErr }, { data: uploads }, { data: slotRows }, { data: profile }] =
          await Promise.all([
            supabase.from("surgery_upload_details").select("*").eq("case_id", caseId).maybeSingle(),
            supabase
              .from("uploads")
              .select("id, type, storage_path, metadata, created_at")
              .eq("case_id", caseId)
              .order("created_at", { ascending: false }),
            supabase
              .from("surgery_upload_slot_reviews")
              .select("case_id, slot_key, status, reviewer_notes, reviewed_by, reviewed_at")
              .eq("case_id", caseId),
            supabase.from("profiles").select("display_name, role").eq("id", requestedBy).maybeSingle(),
          ]);

        if (dErr) throw new Error(dErr.message);
        if (!details) throw new Error("surgery_upload_details missing");

        const det = details as SurgeryUploadDetails;
        const slotReviews = (slotRows as SurgerySlotReviewRow[] | null) ?? [];
        const display =
          (profile?.display_name as string | null | undefined)?.trim() ||
          (profile?.role === "auditor" ? "Reviewer" : "Auditor");

        const { data: verRows, error: vErr } = await supabase
          .from("reports")
          .select("version")
          .eq("case_id", caseId);
        if (vErr) throw new Error(vErr.message);
        const nextVersion =
          (verRows ?? []).reduce((m, r) => Math.max(m, typeof r.version === "number" ? r.version : 0), 0) + 1;

        const pdfPath = `cases/${caseId}/surgery-upload/evidence-review-v${nextVersion}.pdf`;

        const pdfBuffer = await buildSurgeryEvidenceReviewPdfBuffer(supabase, BUCKET, {
          caseId,
          generatedAtIso: new Date().toISOString(),
          requestedByDisplay: display,
          details: det,
          uploads: uploads ?? [],
          slotReviews,
        });

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (upErr) throw new Error(upErr.message);

        const summary = {
          surgery_upload_evidence_review_report: true,
          report_kind: SURGERY_UPLOAD_REPORT_KIND_EVIDENCE_REVIEW_V1,
          generated_at: new Date().toISOString(),
          requested_by: requestedBy,
          pdf_path: pdfPath,
        };

        const { data: rep, error: insErr } = await supabase
          .from("reports")
          .insert({
            case_id: caseId,
            version: nextVersion,
            pdf_path: pdfPath,
            summary,
            status: "complete",
            error: null,
            report_kind: SURGERY_UPLOAD_REPORT_KIND_EVIDENCE_REVIEW_V1,
          })
          .select("id")
          .single();

        if (insErr || !rep?.id) throw new Error(insErr?.message ?? "reports insert failed");

        const now = new Date().toISOString();
        const { error: finErr } = await supabase
          .from("surgery_upload_details")
          .update({
            evidence_report_pipeline_status: "succeeded",
            evidence_report_completed_at: now,
            evidence_report_failed_at: null,
            evidence_report_error: null,
            evidence_report_id: rep.id,
          })
          .eq("case_id", caseId)
          .eq("evidence_report_pipeline_status", "running");

        if (finErr) throw new Error(finErr.message);

        await logEvidenceEvent(supabase, {
          caseId,
          actorId: requestedBy,
          eventType: "surgery-upload/report-completed",
          metadata: {
            source: "surgery-upload",
            reportType: "evidence-review",
            reportId: rep.id,
            pdfPath,
            version: nextVersion,
          },
        });

        return { reportId: rep.id, pdfPath, version: nextVersion };
      });

      return { ok: true };
    } catch (e) {
      const msg = safeErr(e);
      logger.error("surgery evidence report failed", { caseId, message: msg });
      await step.run("mark-failed", async () => {
        const now = new Date().toISOString();
        await supabase
          .from("surgery_upload_details")
          .update({
            evidence_report_pipeline_status: "failed",
            evidence_report_failed_at: now,
            evidence_report_error: msg,
          })
          .eq("case_id", caseId)
          .in("evidence_report_pipeline_status", ["queued", "running"]);

        await logEvidenceEvent(supabase, {
          caseId,
          actorId: requestedBy,
          eventType: "surgery-upload/report-failed",
          metadata: {
            source: "surgery-upload",
            reportType: "evidence-review",
            error: msg,
          },
        });
      });
      throw e;
    }
  }
);
