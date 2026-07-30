/**
 * HA-PATIENT-REPORT-UI-1B — Resolve which patient report adapter / mount to use.
 * Pure decision helper for unit tests and route documentation.
 */

export type PatientPostSurgeryReportMountKind =
  | "donor_healing"
  | "post_surgery"
  | "fallback";

export type PatientPostSurgeryReportMount = {
  kind: PatientPostSurgeryReportMountKind;
  /** Present when kind === "fallback". */
  reason?: "missing_donor_orientation" | "legacy_post_surgery";
};

/**
 * Suggested resolution order:
 * 1. donor-healing case with orientation → donorHealingReportAdapter
 * 2. standard post-surgery case → postSurgeryAuditReportAdapter
 * 3. donor-healing without orientation → safe fallback (still via donor mount path)
 *
 * Do not route donor-entry cases to the generic standard mount when entry is active;
 * the donor mount may still fall back internally if orientation is missing.
 */
export function resolvePatientPostSurgeryReportMount(input: {
  donorHealingEntryActive: boolean;
  hasDonorOrientation: boolean;
}): PatientPostSurgeryReportMount {
  if (input.donorHealingEntryActive) {
    if (input.hasDonorOrientation) {
      return { kind: "donor_healing" };
    }
    return { kind: "fallback", reason: "missing_donor_orientation" };
  }
  return { kind: "post_surgery" };
}

/** True when the case page should mount DonorHealingPatientReport (not the standard adapter mount). */
export function shouldMountDonorHealingPatientReport(
  donorHealingEntryActive: boolean
): boolean {
  return donorHealingEntryActive;
}

/** True when the case page should mount PostSurgeryPatientReport (standard adapter). */
export function shouldMountStandardPostSurgeryPatientReport(
  donorHealingEntryActive: boolean
): boolean {
  return !donorHealingEntryActive;
}
