/**
 * HA-PATIENT-REPORT-UI-1A — Patient-safe healing-stage display labels.
 * Reuses timing contracts from HA-DONOR-HEALING-1A/1B; does not re-map orientation.
 */

import type { DonorOrientationEvidence } from "@/lib/patient/donorHealingOrientationReport";
import type { DonorHealingOrientation } from "@/lib/patient/donorHealingEntry";
import type { PatientReportSemanticTone } from "@/lib/patientReport/types";

const MONTHS_BAND_LABELS: Record<string, string> = {
  under_3: "Under 3 months",
  days_1_3: "1–3 days",
  days_4_7: "4–7 days",
  days_8_14: "8–14 days",
  weeks_3_8: "3–8 weeks",
  "3_6": "3–6 months",
  "6_9": "6–9 months",
  "9_12": "9–12 months",
  "6_12": "6–12 months",
  "12_plus": "12 months or more",
};

/** Shared band → label map for post-surgery timing normalization (1B). */
export const MONTHS_BAND_LABELS_EXPORT: Readonly<Record<string, string>> = MONTHS_BAND_LABELS;

export function patientSafeHealingStageLabel(
  monthsSinceBand: string | null | undefined,
  stageGroup: DonorOrientationEvidence["stageGroup"]
): string {
  if (monthsSinceBand) {
    const key = monthsSinceBand.trim().toLowerCase();
    if (MONTHS_BAND_LABELS[key]) return MONTHS_BAND_LABELS[key];
  }
  switch (stageGroup) {
    case "under_3_months":
      return "Under 3 months";
    case "3_months_or_more":
      return "3 months or more";
    default:
      return "Timing not confirmed";
  }
}

export function patientSafeEvidenceSuitabilityLabel(sufficient: boolean): string {
  return sufficient
    ? "Suitable for structured review"
    : "Limited — more comparable views would help";
}

export function patientSafeNextActionCategory(
  state: DonorHealingOrientation
): { value: string; tone: PatientReportSemanticTone } {
  switch (state) {
    case "compatible_with_reported_stage":
      return { value: "Routine clinical follow-up", tone: "compatible" };
    case "too_early_to_assess_homogeneity":
      return { value: "Continue dated photography", tone: "uncertain" };
    case "temporary_shedding_may_contribute":
      return { value: "Monitor with structured follow-up photos", tone: "uncertain" };
    case "persistent_irregularity_deserves_review":
      return { value: "Discuss with treating clinic", tone: "uncertain" };
    case "direct_clinical_assessment_recommended":
      return { value: "Seek direct clinical assessment", tone: "clinical" };
    case "insufficient_evidence":
    default:
      return { value: "Add clear multi-angle donor photographs", tone: "unavailable" };
  }
}

export function orientationSemanticTone(
  state: DonorHealingOrientation
): PatientReportSemanticTone {
  switch (state) {
    case "compatible_with_reported_stage":
      return "compatible";
    case "too_early_to_assess_homogeneity":
    case "temporary_shedding_may_contribute":
    case "persistent_irregularity_deserves_review":
      return "uncertain";
    case "direct_clinical_assessment_recommended":
      return "clinical";
    case "insufficient_evidence":
    default:
      return "unavailable";
  }
}

/** Stage-aware timeline copy aligned with 1A/1B timing contracts. */
export function buildHealingStageTimeline(input: {
  stageLabel: string;
  stageGroup: DonorOrientationEvidence["stageGroup"];
  state: DonorHealingOrientation;
}): Array<{ id: string; title: string; body: string; emphasis?: boolean }> {
  const { stageLabel, stageGroup, state } = input;

  const whyTiming =
    stageGroup === "under_3_months"
      ? "Early healing often includes temporary redness, dotted texture, and shedding that can dominate appearance."
      : stageGroup === "3_months_or_more"
        ? "After several months, longer-term donor uniformity becomes more meaningful to discuss — still from photographs as orientation, not diagnosis."
        : "Confirmed procedure timing strengthens stage-aware interpretation of donor photographs.";

  const canAssess =
    stageGroup === "under_3_months"
      ? "Short-term healing change and whether views are broadly compatible with an early stage can be discussed."
      : stageGroup === "3_months_or_more"
        ? "Whether appearance is broadly compatible with the reported stage, and whether irregularity deserves structured review, can be discussed."
        : "General orientation from available views can be offered, with lower certainty until timing is confirmed.";

  const tooEarly =
    stageGroup === "under_3_months" || state === "too_early_to_assess_homogeneity"
      ? "Long-term donor uniformity, permanent follicle loss, and remaining graft capacity cannot be determined from photographs at this stage."
      : "Exact donor density, permanent follicle loss, and remaining safe graft capacity cannot be determined from photographs alone.";

  return [
    {
      id: "reported_stage",
      title: "Reported healing stage",
      body: stageLabel,
      emphasis: true,
    },
    {
      id: "why_timing",
      title: "Why timing matters",
      body: whyTiming,
    },
    {
      id: "can_assess",
      title: "What can reasonably be assessed",
      body: canAssess,
    },
    {
      id: "too_early",
      title: "What remains too early to determine",
      body: tooEarly,
    },
  ];
}
