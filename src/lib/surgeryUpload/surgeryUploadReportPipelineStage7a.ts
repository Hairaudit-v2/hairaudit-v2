/**
 * HairAudit Mobile Surgery Upload Portal — Stage 7A (design-only stubs)
 *
 * No report generation, no Inngest, no API calls. These are labels and types for
 * the future surgery-upload evidence review report pipeline (Stage 7B+).
 *
 * @see docs/hairaudit/surgery-upload-report-pipeline-stage-7a.md
 */

/** UI / pipeline phases for report generation (distinct from intake triage status). */
export const SURGERY_UPLOAD_REPORT_PIPELINE_PHASES = [
  "not_started",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type SurgeryUploadReportPipelinePhase =
  (typeof SURGERY_UPLOAD_REPORT_PIPELINE_PHASES)[number];

export const SURGERY_UPLOAD_REPORT_PIPELINE_PHASE_LABELS: Record<
  SurgeryUploadReportPipelinePhase,
  string
> = {
  not_started: "Not generated",
  queued: "Queued",
  running: "Processing",
  succeeded: "Generated",
  failed: "Failed",
  cancelled: "Cancelled",
};

const PHASE_SET = new Set<string>(SURGERY_UPLOAD_REPORT_PIPELINE_PHASES);

export function isSurgeryUploadReportPipelinePhase(
  value: unknown
): value is SurgeryUploadReportPipelinePhase {
  return typeof value === "string" && PHASE_SET.has(value);
}

export function surgeryUploadReportPipelinePhaseLabel(value: unknown): string {
  return isSurgeryUploadReportPipelinePhase(value)
    ? SURGERY_UPLOAD_REPORT_PIPELINE_PHASE_LABELS[value]
    : SURGERY_UPLOAD_REPORT_PIPELINE_PHASE_LABELS.not_started;
}

/** First report kind planned in Stage 7B (string frozen for API/DB contracts). */
export const SURGERY_UPLOAD_REPORT_KIND_EVIDENCE_REVIEW_V1 =
  "surgery_upload_evidence_review_v1" as const;

export type SurgeryUploadReportKind =
  typeof SURGERY_UPLOAD_REPORT_KIND_EVIDENCE_REVIEW_V1;
