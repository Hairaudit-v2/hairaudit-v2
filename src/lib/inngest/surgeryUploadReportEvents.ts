/**
 * Stage 7B — Inngest contracts for the surgery-upload evidence review report.
 * These events are intentionally NOT `case/submitted` and must never fan out to
 * `runAudit` / forensic AI pipelines.
 */
export const INNGEST_SURGERY_UPLOAD_EVIDENCE_REPORT_REQUESTED =
  "hairAudit/surgeryUploadReportRequested" as const;

export type SurgeryUploadEvidenceReportRequestedData = {
  caseId: string;
  requestedBy: string;
  requestedAt: string;
};
