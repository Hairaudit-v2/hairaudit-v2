/**
 * HA-PATIENT-REPORT-UI-1A / 1B — Fallback when donor orientation is absent.
 * Delegates to the canonical post-surgery adapter (1B) for consistent shell content.
 */

import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import { buildPostSurgeryAuditPatientReportViewModel } from "@/lib/patientReport/adapters/postSurgeryAuditReportAdapter";
import type { PatientReportViewModel } from "@/lib/patientReport/types";

export type PostSurgeryFallbackInput = {
  report: PostSurgeryAuditReport;
  statusLabel?: string;
  reportDate?: string | null;
  procedureDate?: string | null;
  monthsSinceBand?: string | null;
  backHref?: string;
  downloadHref?: string;
  uploads?: Array<{
    id?: string;
    type?: string | null;
    storage_path?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  reason?: "missing_donor_orientation" | "legacy_post_surgery";
};

/**
 * Safe fallback when donor orientation is absent, or for legacy incomplete mounts.
 * Renders through the canonical post_surgery PatientReportViewModel contract.
 */
export function buildPostSurgeryFallbackViewModel(
  input: PostSurgeryFallbackInput
): PatientReportViewModel {
  return buildPostSurgeryAuditPatientReportViewModel({
    report: input.report,
    statusLabel: input.statusLabel,
    reportDate: input.reportDate,
    procedureDate: input.procedureDate,
    monthsSinceBand: input.monthsSinceBand,
    backHref: input.backHref,
    downloadHref: input.downloadHref,
    uploads: input.uploads,
    entryContext:
      input.reason === "missing_donor_orientation" ? "donor_healing" : undefined,
    fallbackReason: input.reason ?? "legacy_post_surgery",
  });
}
