import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

/**
 * HA-PUBLIC-PATHWAY-CTA-STYLE-FIX-1A — visual hierarchy for public pathway CTAs.
 * Pathway A (pre-surgery) is the featured primary action unless donor-entry
 * explicitly highlights Post-Surgery Audit.
 */
export function isPathwayCtaPrimary(
  pathway: PatientReviewPathway,
  options?: { highlightPostSurgery?: boolean }
): boolean {
  if (options?.highlightPostSurgery) {
    return pathway === "post_surgery";
  }
  return pathway === "pre_surgery";
}
