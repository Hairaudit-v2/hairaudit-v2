/**
 * Stage 7B — Surgery Upload Evidence Review Report request eligibility.
 *
 * SAFETY: This module must never import or call `/api/submit`, `inngest.send` for
 * `case/submitted`, or any legacy audit runner. Request validation belongs here;
 * persistence and Inngest emission stay in the API route + Inngest function.
 */
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import type { SurgeryUploadReportPipelinePhase } from "@/lib/surgeryUpload/surgeryUploadReportPipelineStage7a";
import { isSurgeryUploadReportPipelinePhase } from "@/lib/surgeryUpload/surgeryUploadReportPipelineStage7a";

export type SurgeryEvidenceReportRequestGate =
  | { ok: true }
  | { ok: false; reason: string; status?: number };

const ACTIVE: SurgeryUploadReportPipelinePhase[] = ["queued", "running"];

export function surgeryEvidenceReportPipelineFromDetails(
  details: Pick<SurgeryUploadDetails, "evidence_report_pipeline_status">
): SurgeryUploadReportPipelinePhase {
  const raw = details.evidence_report_pipeline_status ?? "not_started";
  return isSurgeryUploadReportPipelinePhase(raw) ? raw : "not_started";
}

/** Server-side gate for POST /request-report (auditor auth is checked separately). */
export function evaluateSurgeryEvidenceReportRequest(
  details: SurgeryUploadDetails | null
): SurgeryEvidenceReportRequestGate {
  if (!details) {
    return { ok: false, reason: "Surgery upload not found for this case.", status: 404 };
  }
  if (details.status !== "submitted") {
    return {
      ok: false,
      reason: "Evidence review reports are available after the clinic submits this surgery upload.",
      status: 409,
    };
  }
  const phase = surgeryEvidenceReportPipelineFromDetails(details);
  if (phase === "succeeded") {
    return {
      ok: false,
      reason: "An evidence review report has already been generated. Download the existing PDF.",
      status: 409,
    };
  }
  if (ACTIVE.includes(phase)) {
    return {
      ok: false,
      reason: "Evidence review report is already queued or processing.",
      status: 409,
    };
  }
  if (phase === "cancelled") {
    return { ok: false, reason: "Report generation was cancelled for this case.", status: 409 };
  }
  return { ok: true };
}
