/**
 * Non-blocking upload suggestions derived from Stage 5 sufficiency output.
 * Informational only — does not affect scoring, canSubmit, or required uploads.
 */

import type { PatientAiEvidenceGroupId } from "@/lib/audit/patientAiImageEvidence";
import type {
  PatientImageEvidenceConfidenceResult,
  PatientImageEvidenceSufficiencyLevel,
} from "@/lib/audit/patientImageEvidenceConfidence";
import { PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS } from "@/lib/audit/patientImageEvidenceConfidence";

export type PatientImageEvidenceUploadNudge = {
  groupId: PatientAiEvidenceGroupId | "general";
  /** Short section title for UI */
  areaLabel: string;
  /** Single actionable sentence */
  recommendation: string;
};

/** Higher-signal areas first when capping how many nudges we show */
export const PATIENT_IMAGE_EVIDENCE_NUDGE_PRIORITY: readonly PatientAiEvidenceGroupId[] = [
  "followup_outcome_evidence",
  "graft_handling_evidence",
  "surgical_evidence",
  "donor_monitoring_evidence",
  "baseline_evidence",
] as const;

const NUDGE_PRIORITY = PATIENT_IMAGE_EVIDENCE_NUDGE_PRIORITY;

const MAX_SPECIFIC_NUDGES = 5;

function recommendationForGroup(
  groupId: PatientAiEvidenceGroupId,
  level: PatientImageEvidenceSufficiencyLevel
): string | null {
  if (level === "strong") return null;

  switch (groupId) {
    case "baseline_evidence":
      if (level === "none") {
        return "Add pre-operative front, top, crown, or donor baseline views if you have not already—clearer baselines help reviewers compare over time.";
      }
      if (level === "limited") {
        return "Baseline evidence is limited—add more scalp and donor baseline angles for fuller context.";
      }
      return "Optional: add a few more baseline views to further strengthen pre-op documentation.";

    case "donor_monitoring_evidence":
      if (level === "none") {
        return "Donor monitoring evidence is absent—if you can, add day-of or follow-up donor photos.";
      }
      if (level === "limited") {
        return "Donor monitoring evidence is limited—add donor side views or follow-up donor images at another timepoint.";
      }
      return "Optional: add donor images from another recovery phase for richer monitoring.";

    case "surgical_evidence":
      if (level === "none") {
        return "Surgical-phase evidence is absent—day-of or intraoperative photos help when available.";
      }
      if (level === "limited") {
        return "Surgical evidence is limited—add another surgical-phase view when you can.";
      }
      return "Optional: broaden surgical-phase documentation with an additional angle.";

    case "graft_handling_evidence":
      if (level === "none") {
        return "Graft handling evidence is absent—tray, sorting, or hydration images strengthen technical review if available.";
      }
      if (level === "limited") {
        return "Graft handling evidence is limited—add images from another handling step (e.g. tray close-up, sorting, or solution).";
      }
      return "Optional: add another graft-handling category for fuller technical context.";

    case "followup_outcome_evidence":
      if (level === "none") {
        return "Follow-up outcome evidence is absent—when you reach them, add 3-, 6-, or 12-month progress photos.";
      }
      if (level === "limited") {
        return "Follow-up outcome evidence is limited—6- or 12-month images especially help long-term assessment.";
      }
      return "Optional: add another follow-up month or angle to strengthen longitudinal documentation.";

    default:
      return null;
  }
}

export function areAllPatientImageEvidenceGroupCountsZero(result: PatientImageEvidenceConfidenceResult): boolean {
  return NUDGE_PRIORITY.every((id) => result.groups[id].count === 0);
}

/**
 * Build ordered, capped nudges from sufficiency output. Empty when every area is strong.
 */
export function buildPatientImageEvidenceUploadNudges(
  result: PatientImageEvidenceConfidenceResult
): PatientImageEvidenceUploadNudge[] {
  if (areAllPatientImageEvidenceGroupCountsZero(result)) {
    return [
      {
        groupId: "general",
        areaLabel: "Optional enhancements",
        recommendation:
          "When you’re ready, extra photos in the sections below can strengthen your audit over time—none are required to submit.",
      },
    ];
  }

  const specific: PatientImageEvidenceUploadNudge[] = [];
  for (const id of NUDGE_PRIORITY) {
    const g = result.groups[id];
    const text = recommendationForGroup(id, g.level);
    if (!text) continue;
    specific.push({
      groupId: id,
      areaLabel: PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS[id],
      recommendation: text,
    });
  }

  return specific.slice(0, MAX_SPECIFIC_NUDGES);
}
