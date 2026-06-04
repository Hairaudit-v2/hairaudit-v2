/**
 * Stage 7B/7C — Forensic (legacy AI audit) report rows vs surgery evidence review PDFs.
 *
 * `reports.report_kind` is null for historical forensic rows; surgery evidence review
 * uses `surgery_upload_evidence_review_v1`. Latest forensic UI must never pick the
 * evidence PDF by version alone.
 */
export type ReportRowWithOptionalKind = {
  report_kind?: string | null;
};

/** Rows that belong to the forensic / AI audit report UX (excludes evidence-review PDFs). */
export function filterForensicAuditReports<T extends ReportRowWithOptionalKind>(reports: readonly T[]): T[] {
  return reports.filter((r) => !r.report_kind);
}
