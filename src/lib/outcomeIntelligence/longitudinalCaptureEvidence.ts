/**
 * FI-OUTCOME-INTELLIGENCE-1C — Evidence satisfaction for capture milestones.
 *
 * Reuses HA-PROJECTION-1E collectStageEvidence / role resolution.
 * Does not invent a competing photo taxonomy or quality thresholds.
 */

import { collectStageEvidence } from "@/lib/projection/longitudinalOutcomeObservation";
import type {
  LongitudinalEvidenceContext,
  LongitudinalEvidenceRole,
  LongitudinalOutcomeStage,
  ProjectionUploadInput,
} from "@/lib/projection/types";
import {
  patientSafeLabelForRole,
  publicViewKeyForRole,
  type MilestoneEvidenceRequirements,
} from "./longitudinalCapturePolicy";

export type MilestoneEvidenceStatus = {
  presentEvidenceRoles: LongitudinalEvidenceRole[];
  missingRequiredEvidenceRoles: LongitudinalEvidenceRole[];
  missingRecommendedEvidenceRoles: LongitudinalEvidenceRole[];
  requiredSatisfied: boolean;
  anyEvidencePresent: boolean;
  /** Rejected by 1E stage provenance (not counted). */
  rejectedCount: number;
};

/**
 * Inspect canonical uploads for a planned milestone stage.
 * Month-banded aliases only satisfy their own stage (via 1E resolver).
 */
export function assessMilestoneEvidence(args: {
  stage: LongitudinalOutcomeStage;
  uploads: ProjectionUploadInput[];
  requirements: MilestoneEvidenceRequirements;
  caseContext?: LongitudinalEvidenceContext;
}): MilestoneEvidenceStatus {
  const collected = collectStageEvidence(
    args.uploads,
    args.stage,
    args.caseContext ?? {}
  );
  const present = collected.presentRoles;
  const presentSet = new Set(present);

  const missingRequired = args.requirements.required.filter((r) => !presentSet.has(r));
  const missingRecommended = args.requirements.recommended.filter(
    (r) => !presentSet.has(r)
  );

  return {
    presentEvidenceRoles: present,
    missingRequiredEvidenceRoles: missingRequired,
    missingRecommendedEvidenceRoles: missingRecommended,
    requiredSatisfied: missingRequired.length === 0,
    anyEvidencePresent: present.length > 0,
    rejectedCount: collected.rejected.length,
  };
}

export function toPatientViewDtos(args: {
  roles: LongitudinalEvidenceRole[];
  present: ReadonlySet<LongitudinalEvidenceRole> | LongitudinalEvidenceRole[];
}): Array<{ key: string; label: string; complete: boolean }> {
  const presentSet = Array.isArray(args.present)
    ? new Set(args.present)
    : args.present;
  return args.roles.map((role) => ({
    key: publicViewKeyForRole(role),
    label: patientSafeLabelForRole(role),
    complete: presentSet.has(role),
  }));
}

/** Assert patient-facing labels never leak internal followup_* keys. */
export function assertPatientSafeMissingLabels(
  labels: string[]
): { ok: true } | { ok: false; violations: string[] } {
  const violations = labels.filter(
    (l) => /followup_|postop_month|patient_photo:|img_followup/i.test(l)
  );
  return violations.length ? { ok: false, violations } : { ok: true };
}
