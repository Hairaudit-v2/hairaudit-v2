/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Clinician approval checklist + rejection reasons.
 */

import type {
  PreSurgeryApprovalChecklist,
  PreSurgeryIllustrativeProjection,
  PreSurgeryProjectionRejectionReason,
} from "../types";
import {
  PRE_SURGERY_PROJECTION_GENERATION_POLICY_VERSION,
  PRE_SURGERY_PROJECTION_SAFETY_LABEL_VERSION,
} from "../versions";
import { findUnsafeProjectionLabel } from "./safety";
import { assertProjectionStatusTransition } from "./stateMachine";
import { patientSafeDisclaimerForMode } from "./modeContracts";
import {
  isPatientReportOutcomeArtifact,
  resolveProjectionArtifactType,
} from "./artifactTypes";

export const APPROVAL_CHECKLIST_KEYS = [
  "correctPatientAndCase",
  "correctSourceImages",
  "correctApprovedGraftPlanVersion",
  "hairlineWithinApprovedPlan",
  "coverageZonesDoNotExceedPlan",
  "deferredZonesRemainVisiblyDeferred",
  "donorLimitationsNotMisrepresented",
  "densityNotPresentedAsGuaranteed",
  "visualOutputDoesNotImplyExactFutureGrowth",
  "patientSafeDisclaimerPresent",
  "suitableToShare",
] as const satisfies readonly (keyof PreSurgeryApprovalChecklist)[];

export const REJECTION_REASONS = [
  "incorrect_hairline",
  "excessive_density",
  "incorrect_zone_coverage",
  "image_artefact",
  "facial_or_scalp_distortion",
  "donor_implication_misleading",
  "source_image_unsuitable",
  "plan_changed",
  "wrong_projection_mode",
  "other_safety_concern",
] as const satisfies readonly PreSurgeryProjectionRejectionReason[];

export type ApprovalActor = {
  clinicianId: string;
  role: string;
  organisationId: string | null;
};

export type ApproveProjectionInput = {
  projection: PreSurgeryIllustrativeProjection;
  actor: ApprovalActor;
  checklist: PreSurgeryApprovalChecklist;
  approvalNote?: string | null;
  overrideReason?: string | null;
  now?: string;
  providerModelVersion?: string | null;
  /** 2D — when true (shadow), approve for clinician archive but do not enable patient sharing. */
  shadowMode?: boolean;
  /** 2D — when true, block enabling patient sharing on approve. */
  patientSharingKillSwitch?: boolean;
};

export type ApproveProjectionResult =
  | { ok: true; projection: PreSurgeryIllustrativeProjection }
  | { ok: false; error: string; code: string };

export function allChecklistItemsConfirmed(checklist: PreSurgeryApprovalChecklist): boolean {
  return APPROVAL_CHECKLIST_KEYS.every((k) => checklist[k] === true);
}

export function approveIllustrativeProjectionWithChecklist(
  input: ApproveProjectionInput
): ApproveProjectionResult {
  const { projection, actor, checklist } = input;
  const now = input.now ?? new Date().toISOString();

  const fromStatus =
    projection.status === "generated" ? "generated" : projection.status;
  // Allow generated → clinician_review → approved in one clinical action when checklist complete.
  if (fromStatus === "generated") {
    const toReview = assertProjectionStatusTransition("generated", "clinician_review");
    if (!toReview.ok) {
      return { ok: false, code: toReview.code, error: toReview.message };
    }
  } else if (fromStatus !== "clinician_review") {
    return {
      ok: false,
      code: "invalid_status",
      error: "Only generated or clinician_review projections can be approved",
    };
  }

  if (!allChecklistItemsConfirmed(checklist)) {
    return {
      ok: false,
      code: "checklist_incomplete",
      error: "All approval checklist items must be explicitly confirmed",
    };
  }

  if (findUnsafeProjectionLabel(projection.patientSafeLabel)) {
    return {
      ok: false,
      code: "unsafe_label",
      error: "Projection label fails patient-safe wording checks",
    };
  }

  // REAL-ASSET-1A — Approved is impossible without a valid image asset.
  if (
    !projection.storagePath ||
    /\.stub$/i.test(projection.storagePath) ||
    projection.storagePath.includes("/stub/")
  ) {
    return {
      ok: false,
      code: "stub_placeholder",
      error: "Stub generation — no image asset produced. Approval requires a valid stored image.",
    };
  }
  if (!projection.outputChecksum) {
    return {
      ok: false,
      code: "missing_image_asset",
      error: "Approved status is impossible without a valid stored image asset checksum",
    };
  }

  const disclaimer =
    projection.patientSafeDisclaimer ?? patientSafeDisclaimerForMode(projection.mode);
  if (findUnsafeProjectionLabel(disclaimer)) {
    return {
      ok: false,
      code: "unsafe_disclaimer",
      error: "Patient-safe disclaimer fails wording checks",
    };
  }

  if (!checklist.patientSafeDisclaimerPresent) {
    return {
      ok: false,
      code: "disclaimer_missing",
      error: "Patient-safe disclaimer must be confirmed present",
    };
  }

  const transition = assertProjectionStatusTransition(
    fromStatus === "generated" ? "clinician_review" : fromStatus,
    "approved"
  );
  if (!transition.ok) {
    return { ok: false, code: transition.code, error: transition.message };
  }

  const hasOverride = Boolean(input.overrideReason?.trim());
  const artifactType = resolveProjectionArtifactType({
    artifactType: projection.artifactType,
    providerId: projection.providerId,
  });
  // PHOTOREALISTIC-OUTCOME-2A — Graft Allocation Maps / hairline designs are clinical-only.
  // Patient sharing is reserved for approved Illustrative Projected Outcome assets.
  const enableSharing =
    isPatientReportOutcomeArtifact(artifactType) &&
    !input.shadowMode &&
    !input.patientSharingKillSwitch &&
    !projection.shadowMode &&
    checklist.suitableToShare;

  return {
    ok: true,
    projection: {
      ...projection,
      status: "approved",
      approvedBy: actor.clinicianId,
      approvedAt: now,
      approvedRole: actor.role,
      approvedOrganisationId: actor.organisationId,
      approvalChecklist: { ...checklist },
      approvalNote: input.approvalNote?.trim() ? input.approvalNote.trim().slice(0, 1000) : null,
      approvalOverrideReason: hasOverride ? input.overrideReason!.trim().slice(0, 500) : null,
      safetyLabelVersion:
        projection.safetyLabelVersion ?? PRE_SURGERY_PROJECTION_SAFETY_LABEL_VERSION,
      generationPolicyVersion:
        projection.generationPolicyVersion ?? PRE_SURGERY_PROJECTION_GENERATION_POLICY_VERSION,
      providerModelVersion:
        input.providerModelVersion ?? projection.providerModelVersion ?? null,
      patientSafeDisclaimer: disclaimer,
      patientSharingEnabled: enableSharing,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      rejectionReasonCode: null,
    },
  };
}

/** @deprecated Prefer approveIllustrativeProjectionWithChecklist — thin bridge for older callers. */
export function approveIllustrativeProjection(
  projection: PreSurgeryIllustrativeProjection,
  approvedBy: string,
  now = new Date().toISOString()
): PreSurgeryIllustrativeProjection | { error: string } {
  const checklist: PreSurgeryApprovalChecklist = {
    correctPatientAndCase: true,
    correctSourceImages: true,
    correctApprovedGraftPlanVersion: true,
    hairlineWithinApprovedPlan: true,
    coverageZonesDoNotExceedPlan: true,
    deferredZonesRemainVisiblyDeferred: true,
    donorLimitationsNotMisrepresented: true,
    densityNotPresentedAsGuaranteed: true,
    visualOutputDoesNotImplyExactFutureGrowth: true,
    patientSafeDisclaimerPresent: true,
    suitableToShare: true,
  };
  const result = approveIllustrativeProjectionWithChecklist({
    projection,
    actor: { clinicianId: approvedBy, role: "clinician", organisationId: null },
    checklist,
    now,
  });
  if (!result.ok) return { error: result.error };
  return result.projection;
}

export function rejectIllustrativeProjection(
  projection: PreSurgeryIllustrativeProjection,
  rejectedBy: string,
  reason: string,
  now = new Date().toISOString(),
  reasonCode?: PreSurgeryProjectionRejectionReason | null
): PreSurgeryIllustrativeProjection {
  const code = reasonCode ?? "other_safety_concern";
  return {
    ...projection,
    status: "rejected",
    rejectedBy,
    rejectedAt: now,
    rejectionReason: reason.slice(0, 500),
    rejectionReasonCode: REJECTION_REASONS.includes(code) ? code : "other_safety_concern",
    patientSharingEnabled: false,
  };
}

export function supersedeApprovedProjection(
  previous: PreSurgeryIllustrativeProjection,
  now = new Date().toISOString()
): PreSurgeryIllustrativeProjection {
  if (previous.status !== "approved") return previous;
  return {
    ...previous,
    status: "superseded",
    patientSharingEnabled: false,
    supersededAt: now,
  };
}

export function emptyApprovalChecklist(): PreSurgeryApprovalChecklist {
  return {
    correctPatientAndCase: false,
    correctSourceImages: false,
    correctApprovedGraftPlanVersion: false,
    hairlineWithinApprovedPlan: false,
    coverageZonesDoNotExceedPlan: false,
    deferredZonesRemainVisiblyDeferred: false,
    donorLimitationsNotMisrepresented: false,
    densityNotPresentedAsGuaranteed: false,
    visualOutputDoesNotImplyExactFutureGrowth: false,
    patientSafeDisclaimerPresent: false,
    suitableToShare: false,
  };
}
