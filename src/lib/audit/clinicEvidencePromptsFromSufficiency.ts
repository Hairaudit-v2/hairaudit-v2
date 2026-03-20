/**
 * Professional/coordination tone prompts for clinic staff, derived from Stage 5 sufficiency.
 * Informational only — does not affect scoring, canSubmit, or required uploads.
 */

import type { PatientAiEvidenceGroupId } from "@/lib/audit/patientAiImageEvidence";
import type {
  PatientImageEvidenceConfidenceResult,
  PatientImageEvidenceSufficiencyLevel,
} from "@/lib/audit/patientImageEvidenceConfidence";
import { PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS } from "@/lib/audit/patientImageEvidenceConfidence";
import {
  areAllPatientImageEvidenceGroupCountsZero,
  PATIENT_IMAGE_EVIDENCE_NUDGE_PRIORITY,
} from "@/lib/audit/patientImageEvidenceUploadNudges";

export type ClinicEvidencePrompt = {
  groupId: PatientAiEvidenceGroupId | "general";
  heading: string;
  /** Single paragraph for staff */
  prompt: string;
};

const MAX_PROMPTS = 5;

function clinicPromptForGroup(
  groupId: PatientAiEvidenceGroupId,
  level: PatientImageEvidenceSufficiencyLevel
): string | null {
  if (level === "strong") return null;

  switch (groupId) {
    case "baseline_evidence":
      if (level === "none") {
        return "Grouped evidence shows no baseline photography yet. When appropriate, consider inviting the patient to add standard pre-operative scalp and donor views—optional for submission.";
      }
      if (level === "limited") {
        return "Baseline imaging looks thin. Staff may suggest additional pre-operative scalp or donor angles if the patient can provide them.";
      }
      return "Optional: a few more baseline angles would further document the pre-operative state.";

    case "donor_monitoring_evidence":
      if (level === "none") {
        return "No donor monitoring photos appear in grouped evidence. Day-of or follow-up donor documentation—when available—helps reviewers track healing.";
      }
      if (level === "limited") {
        return "Donor monitoring is limited to early timepoints. Consider encouraging donor side or later donor follow-up images when clinically reasonable.";
      }
      return "Optional: donor images from another recovery phase would deepen longitudinal context.";

    case "surgical_evidence":
      if (level === "none") {
        return "Surgical-phase patient photos are not present in grouped evidence. If the patient has day-of or intraoperative views, coordinating upload can help technical review.";
      }
      if (level === "limited") {
        return "Surgical-phase documentation is sparse. An additional peri-operative angle may be worth suggesting if the patient can safely provide it.";
      }
      return "Optional: broaden surgical-phase documentation with one more view if feasible.";

    case "graft_handling_evidence":
      if (level === "none") {
        return "Graft handling imagery is absent. Tray, sorting, or preservation photos—when patients can obtain them—support technical audit context but are not required.";
      }
      if (level === "limited") {
        return "Graft handling coverage is narrow. Consider suggesting another handling step (e.g. tray detail, sorting, or solution) if the patient has access.";
      }
      return "Optional: another graft-handling category would round out technical documentation.";

    case "followup_outcome_evidence":
      if (level === "none") {
        return "Longitudinal outcome photos are not yet in grouped evidence. Remind patients—at milestones—that 3-, 6-, or 12-month views are valuable when they return for visits.";
      }
      if (level === "limited") {
        return "Follow-up is light; 6- and 12-month photography especially strengthens long-term assessment. Coordinate gently when patients reach those milestones.";
      }
      return "Optional: another follow-up month or view would strengthen longitudinal documentation.";

    default:
      return null;
  }
}

/**
 * Build capped clinic-facing prompts from the same sufficiency output as patient nudges.
 */
export function buildClinicEvidencePromptsFromSufficiency(
  result: PatientImageEvidenceConfidenceResult
): ClinicEvidencePrompt[] {
  if (areAllPatientImageEvidenceGroupCountsZero(result)) {
    return [
      {
        groupId: "general",
        heading: "Patient imaging (optional)",
        prompt:
          "No optional patient photo bundles appear in grouped evidence yet. When clinically appropriate, your team may remind patients that supplementary uploads enrich the audit narrative—all remain optional for submission.",
      },
    ];
  }

  const out: ClinicEvidencePrompt[] = [];
  for (const id of PATIENT_IMAGE_EVIDENCE_NUDGE_PRIORITY) {
    const g = result.groups[id];
    const text = clinicPromptForGroup(id, g.level);
    if (!text) continue;
    out.push({
      groupId: id,
      heading: PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS[id],
      prompt: text,
    });
  }

  return out.slice(0, MAX_PROMPTS);
}
