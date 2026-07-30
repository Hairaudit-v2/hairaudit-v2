/**
 * HA-PATIENT-REPORT-UI-1B — shared patient-safe Post-Surgery Audit copy.
 * Labels map existing report contracts; do not invent clinical categories.
 */

import type { PostSurgeryProceduralOutcomeId } from "@/lib/reports/postSurgeryAuditReport";
import type { PostSurgeryRepairConsiderationId } from "@/lib/reports/postSurgeryAuditReport";
import type { PostSurgeryReviewSectionId } from "@/lib/reports/postSurgeryAuditReport";
import type { PostSurgeryScorecardMetricId } from "@/lib/reports/postSurgeryAuditReport";
import type { PatientReportSemanticTone } from "@/lib/patientReport/types";

/** Patient-safe outcome titles aligned with existing procedural outcome IDs. */
export const POST_SURGERY_OUTCOME_TITLES: Record<PostSurgeryProceduralOutcomeId, string> = {
  strong_outcome: "Strong procedural outcome",
  moderate_concerns: "Moderate procedural concerns identified",
  donor_preservation_concerns: "Donor preservation concerns identified",
  significant_concerns: "Significant procedural concerns identified",
};

export const POST_SURGERY_REPAIR_LABELS: Record<PostSurgeryRepairConsiderationId, string> = {
  no_repair_concerns: "No repair concerns identified",
  minor_observation: "Minor concerns requiring observation",
  moderate_consultation: "Moderate repair consultation recommended",
  significant_planning: "Significant repair planning may be beneficial",
};

export const POST_SURGERY_SECTION_DOMAIN_LABELS: Record<PostSurgeryReviewSectionId, string> = {
  overall_procedure: "Overall procedure",
  donor_area: "Donor uniformity",
  extraction_pattern: "Visible extraction pattern",
  density_distribution: "Density and coverage",
  recipient_area: "Recipient-area appearance",
  procedural_integrity: "Procedural documentation",
  long_term_risk: "Long-term considerations",
  repair_considerations: "Repair considerations",
};

export const POST_SURGERY_SCORECARD_LABELS: Record<PostSurgeryScorecardMetricId, string> = {
  donor_preservation: "Donor preservation",
  extraction_pattern: "Extraction pattern",
  density_distribution: "Density distribution",
  recipient_area: "Recipient area",
  healing_quality: "Healing quality",
  repair_probability: "Repair consideration",
};

export const POST_SURGERY_EVIDENCE_LIMITATIONS = [
  "Photographs cannot directly count surviving grafts.",
  "Photographs do not replace clinical examination.",
  "Lighting, angle, hair length, and styling alter appearance.",
  "Exact density requires measurement beyond photographic review.",
  "Exact donor reserve cannot be established from photographs alone.",
  "Causal conclusions may not be possible from images and questionnaire answers alone.",
  "Missing time points limit before-and-after comparison.",
  "Urgent symptoms require direct clinical care — this report does not replace urgent medical care.",
] as const;

export const POST_SURGERY_REMAINS_UNCERTAIN = [
  "Exact graft survival cannot be measured from photographs.",
  "Exact implanted density cannot be confirmed from images alone.",
  "Permanent follicle loss may not be determinable without clinical examination.",
  "Donor reserve and remaining capacity require in-person assessment.",
  "Surgical causation cannot be established from photographic review alone.",
  "Conclusions that require trichoscopy or physical examination remain outside this report.",
] as const;

export function outcomeSemanticTone(
  outcomeId: PostSurgeryProceduralOutcomeId
): PatientReportSemanticTone {
  switch (outcomeId) {
    case "strong_outcome":
      return "compatible";
    case "moderate_concerns":
      return "uncertain";
    case "donor_preservation_concerns":
    case "significant_concerns":
      return "clinical";
    default:
      return "info";
  }
}

export function nextActionFromRepair(
  repairId: PostSurgeryRepairConsiderationId,
  outcomeId: PostSurgeryProceduralOutcomeId
): { value: string; tone: PatientReportSemanticTone } {
  if (outcomeId === "significant_concerns" || repairId === "significant_planning") {
    return { value: "Discuss findings with the treating clinic", tone: "clinical" };
  }
  if (repairId === "moderate_consultation") {
    return { value: "Discuss findings with the treating clinic", tone: "uncertain" };
  }
  if (repairId === "minor_observation") {
    return { value: "Continue routine clinical follow-up", tone: "uncertain" };
  }
  if (outcomeId === "strong_outcome") {
    return { value: "Continue routine clinical follow-up", tone: "compatible" };
  }
  return { value: "Discuss findings with the treating clinic", tone: "info" };
}
