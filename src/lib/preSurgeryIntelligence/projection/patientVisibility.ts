/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Patient visibility gate for illustrative projections.
 */

import type { PreSurgeryGraftPlan, PreSurgeryIllustrativeProjection } from "../types";
import { findUnsafeProjectionLabel, projectionInvalidatedByPlanChange } from "./safety";
import { isPatientVisibleProjectionStatus } from "./stateMachine";
import { patientSafeDisclaimerForMode } from "./modeContracts";

export const PATIENT_PROJECTION_FRAMING = [
  "This image is illustrative.",
  "It is based on the current clinical plan and supplied images.",
  "It does not predict exact graft survival or growth.",
  "It does not guarantee density or final appearance.",
  "Surgical decisions remain subject to in-person clinical assessment.",
  "The plan may change on the day of surgery.",
  "Outcomes remain subject to donor capacity, healing, hair characteristics, future loss, treatment adherence, and clinical factors.",
] as const;

const FORBIDDEN_PATIENT_CLAIM_PATTERNS = [
  /\bpredicted result\b/i,
  /\bexpected result\b/i,
  /\bguaranteed\b/i,
  /\bfinal result\b/i,
  /\bexact (?:future )?growth\b/i,
];

export type PatientVisibilityDecision =
  | {
      visible: true;
      framing: readonly string[];
      disclaimer: string;
      label: string;
      projectionId: string;
      projectionVersion: number;
    }
  | {
      visible: false;
      reason:
        | "not_approved"
        | "superseded"
        | "expired"
        | "stale"
        | "sharing_disabled"
        | "sharing_kill_switch"
        | "shadow_mode"
        | "consent_required"
        | "plan_invalid"
        | "approval_version_mismatch"
        | "missing_safety_labels"
        | "unsafe_language";
      message: string;
    };

export function evaluatePatientProjectionVisibility(input: {
  projection: PreSurgeryIllustrativeProjection;
  currentApprovedPlan: PreSurgeryGraftPlan | null;
  /** When present, must match projection.id for the approved version being shared. */
  expectedProjectionId?: string | null;
  now?: string;
  /** 2D — global patient-sharing kill switch. */
  patientSharingKillSwitch?: boolean;
  /** 2D — shadow mode blocks all patient visibility. */
  shadowMode?: boolean;
  /** 2D — consent recorded for this projection. */
  patientConsentRecorded?: boolean;
}): PatientVisibilityDecision {
  const { projection, currentApprovedPlan } = input;
  const nowMs = Date.parse(input.now ?? new Date().toISOString());

  if (!isPatientVisibleProjectionStatus(projection.status)) {
    return {
      visible: false,
      reason: projection.status === "superseded" ? "superseded" : "not_approved",
      message: "Projection is not approved for patient viewing",
    };
  }

  if (projection.status === "expired") {
    return { visible: false, reason: "expired", message: "Projection has expired" };
  }

  if (projection.staleAt) {
    return {
      visible: false,
      reason: "stale",
      message: "Projection is stale and is no longer shareable",
    };
  }

  if (projection.expiresAt && Date.parse(projection.expiresAt) < nowMs) {
    return { visible: false, reason: "expired", message: "Projection share window has expired" };
  }

  if (input.patientSharingKillSwitch) {
    return {
      visible: false,
      reason: "sharing_kill_switch",
      message: "Patient sharing kill switch is active",
    };
  }

  if (input.shadowMode || projection.shadowMode) {
    return {
      visible: false,
      reason: "shadow_mode",
      message: "Shadow mode prevents patient sharing",
    };
  }

  if (projection.patientSharingEnabled !== true) {
    return {
      visible: false,
      reason: "sharing_disabled",
      message: "Patient sharing is not enabled for this projection",
    };
  }

  if (input.patientConsentRecorded === false) {
    return {
      visible: false,
      reason: "consent_required",
      message: "Patient consent for illustrative projection sharing is required",
    };
  }

  if (
    input.expectedProjectionId &&
    input.expectedProjectionId !== projection.id
  ) {
    return {
      visible: false,
      reason: "approval_version_mismatch",
      message: "Approval does not belong to the current projection version",
    };
  }

  if (
    projectionInvalidatedByPlanChange(
      projection.graftPlanId,
      projection.graftPlanVersion,
      currentApprovedPlan
    )
  ) {
    return {
      visible: false,
      reason: "plan_invalid",
      message: "Referenced graft-plan version is no longer valid",
    };
  }

  if (!projection.safetyLabelVersion || !projection.patientSafeDisclaimer) {
    // Fall back to mode disclaimer only when label version present.
    if (!projection.safetyLabelVersion) {
      return {
        visible: false,
        reason: "missing_safety_labels",
        message: "Safety labels are required for patient visibility",
      };
    }
  }

  const disclaimer =
    projection.patientSafeDisclaimer ?? patientSafeDisclaimerForMode(projection.mode);
  if (findUnsafeProjectionLabel(projection.patientSafeLabel) || findUnsafeProjectionLabel(disclaimer)) {
    return {
      visible: false,
      reason: "unsafe_language",
      message: "Patient-facing copy fails safety wording checks",
    };
  }

  for (const pattern of FORBIDDEN_PATIENT_CLAIM_PATTERNS) {
    if (pattern.test(projection.patientSafeLabel) || pattern.test(disclaimer)) {
      return {
        visible: false,
        reason: "unsafe_language",
        message: "Patient-facing copy must not imply guaranteed outcomes",
      };
    }
  }

  return {
    visible: true,
    framing: PATIENT_PROJECTION_FRAMING,
    disclaimer,
    label: projection.patientSafeLabel,
    projectionId: projection.id,
    projectionVersion: projection.projectionVersion ?? 1,
  };
}

export function findUnsafePatientClaimLanguage(text: string): string | null {
  for (const pattern of FORBIDDEN_PATIENT_CLAIM_PATTERNS) {
    if (pattern.test(text)) return pattern.source;
  }
  return null;
}
