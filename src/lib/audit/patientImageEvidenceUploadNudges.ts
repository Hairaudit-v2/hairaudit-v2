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
        return "If you can, add Before Surgery photos: front, top, crown, and back of head. More angles help.";
      }
      if (level === "limited") {
        return "You could add more Before Surgery angles of your scalp and back of head.";
      }
      return "Optional: add a few more Before Surgery views if you have them.";

    case "donor_monitoring_evidence":
      if (level === "none") {
        return "If you can, add photos of the back of your head from surgery day or later months.";
      }
      if (level === "limited") {
        return "You could add more photos of the back or sides of your head from another time.";
      }
      return "Optional: add another photo of the back of your head from a different time if you have one.";

    case "surgical_evidence":
      if (level === "none") {
        return "If you have them, add Surgery Day photos (during the procedure or right after).";
      }
      if (level === "limited") {
        return "You could add one more Surgery Day photo when you can.";
      }
      return "Optional: add another Surgery Day angle if you have it.";

    case "graft_handling_evidence":
      if (level === "none") {
        return "If your clinic shared them, add photos of grafts on the tray, sorting, or liquid they sat in.";
      }
      if (level === "limited") {
        return "You could add another photo of grafts (tray, sorting, or liquid) if you have one.";
      }
      return "Optional: add one more graft tray–type photo if you have it.";

    case "followup_outcome_evidence":
      if (level === "none") {
        return "When you reach those times, add 3 Month Photos, 6 Month Photos, or 12 Month Photos if you can.";
      }
      if (level === "limited") {
        return "6 Month Photos or 12 Month Photos would help if you have them.";
      }
      return "Optional: add another month or angle in the progress section if you have it.";

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
          "When you are ready, you can add extra photos in the sections below. None are required to submit.",
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
