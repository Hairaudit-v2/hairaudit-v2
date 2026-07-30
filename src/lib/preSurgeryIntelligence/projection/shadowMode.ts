/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Shadow-mode (non-patient) pilot policy.
 *
 * Safest first activation: real eligible cases → ImagingOS → clinician_review,
 * with patient sharing and automatic report inclusion prevented globally.
 */

import type { PreSurgeryIllustrativeProjection } from "../types";
import type { ProjectionActivationControls } from "./activationControls";

export const SHADOW_QUALITY_REVIEW_DIMENSIONS = [
  "hairline_accuracy",
  "zone_boundary_accuracy",
  "density_realism",
  "donor_limitation_representation",
  "facial_and_scalp_distortion",
  "artefacts",
  "deferred_zone_handling",
  "consistency_across_projection_modes",
  "patient_safe_visual_interpretation",
] as const;

export type ShadowQualityReviewDimension = (typeof SHADOW_QUALITY_REVIEW_DIMENSIONS)[number];

export type ShadowQualityReviewOutcome = {
  projectionId: string;
  reviewerId: string;
  seniorClinician: boolean;
  comparedToSourcePlan: boolean;
  safetyChecklistComplete: boolean;
  dimensions: Partial<Record<ShadowQualityReviewDimension, "pass" | "fail" | "deferred">>;
  rejectionReasonCode?: string | null;
  notes?: string | null;
  reviewedAt: string;
};

export type ShadowModePolicy = {
  active: boolean;
  preventPatientSharing: true;
  preventAutomaticReportInclusion: true;
  requireSeniorClinicianReview: true;
  storeAsClinicianReview: true;
  compareWithSourcePlan: true;
  recordStructuredRejectionReasons: true;
};

export function resolveShadowModePolicy(
  controls: ProjectionActivationControls
): ShadowModePolicy | null {
  if (!controls.shadowMode && controls.releaseStage !== "internal_review_only") {
    return null;
  }
  return {
    active: true,
    preventPatientSharing: true,
    preventAutomaticReportInclusion: true,
    requireSeniorClinicianReview: true,
    storeAsClinicianReview: true,
    compareWithSourcePlan: true,
    recordStructuredRejectionReasons: true,
  };
}

/** Apply shadow constraints to a freshly generated projection. */
export function applyShadowModeToProjection(
  projection: PreSurgeryIllustrativeProjection,
  policy: ShadowModePolicy | null
): PreSurgeryIllustrativeProjection {
  if (!policy?.active) return projection;
  return {
    ...projection,
    status: projection.status === "validation_failed" ? projection.status : "clinician_review",
    patientSharingEnabled: false,
  };
}

export function assertSeniorClinicianForShadowApproval(input: {
  policy: ShadowModePolicy | null;
  actorRole: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.policy?.active) return { ok: true };
  const role = input.actorRole.toLowerCase();
  const senior =
    role.includes("senior") ||
    role === "auditor" ||
    role === "lead_clinician" ||
    role === "medical_director";
  if (!senior) {
    return {
      ok: false,
      code: "senior_review_required",
      message: "Shadow mode requires senior clinician review before approval",
    };
  }
  return { ok: true };
}

export function validateShadowQualityReview(
  outcome: ShadowQualityReviewOutcome
): { ok: true } | { ok: false; code: string; message: string } {
  if (!outcome.seniorClinician) {
    return {
      ok: false,
      code: "senior_review_required",
      message: "Shadow quality review must be performed by a senior clinician",
    };
  }
  if (!outcome.comparedToSourcePlan) {
    return {
      ok: false,
      code: "source_plan_comparison_required",
      message: "Shadow review must compare output with the source plan",
    };
  }
  if (!outcome.safetyChecklistComplete) {
    return {
      ok: false,
      code: "safety_checklist_incomplete",
      message: "Shadow review safety checklist must be complete",
    };
  }
  return { ok: true };
}

/** Bounded pilot cohort categories for quality-review documentation. */
export const QUALITY_REVIEW_COHORT_CATEGORIES = [
  "internal_demo",
  "synthetic_or_consented_staff",
  "retrospective_completed",
  "consented_new_pre_surgery",
] as const;

export type QualityReviewCohortCategory = (typeof QUALITY_REVIEW_COHORT_CATEGORIES)[number];
