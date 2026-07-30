/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Projection staleness handling.
 *
 * Stale projections remain auditable but are no longer shareable or selectable
 * for a new report.
 */

import {
  PRE_SURGERY_PROJECTION_GENERATION_POLICY_VERSION,
} from "../versions";
import type {
  ClinicalImageAnnotation,
  ClinicalImageReview,
  ClinicalObservation,
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
} from "../types";
import { projectionInvalidatedByPlanChange } from "./safety";

export type ProjectionStaleReason =
  | "approved_graft_plan_changed"
  | "source_image_role_or_orientation_changed"
  | "relevant_annotation_changed"
  | "approved_observations_changed"
  | "projection_policy_version_changed"
  | "provider_or_model_retired"
  | "case_no_longer_eligible"
  | "patient_sharing_revoked"
  | "manual";

export type StalenessContext = {
  currentApprovedPlan: PreSurgeryGraftPlan | null;
  /** Current reviews for images that were sources at generation time. */
  currentSourceReviews: ClinicalImageReview[];
  /** Snapshot of source roles/orientation at generation (from inputSnapshot). */
  frozenSourceRoles?: Array<{
    imageId: string;
    role: string;
    orientation?: string | null;
    mirrored?: boolean | null;
  }>;
  currentAnnotations: ClinicalImageAnnotation[];
  frozenAnnotationIds?: string[];
  currentObservations: ClinicalObservation[];
  frozenObservationIds?: string[];
  currentPolicyVersion?: string;
  retiredProviderIds?: string[];
  retiredModelVersions?: string[];
  caseEligible: boolean;
  patientSharingRevoked?: boolean;
};

export type StalenessDecision =
  | { stale: false }
  | { stale: true; reasons: ProjectionStaleReason[] };

export function evaluateProjectionStaleness(
  projection: PreSurgeryIllustrativeProjection,
  ctx: StalenessContext
): StalenessDecision {
  const reasons: ProjectionStaleReason[] = [];

  if (
    projectionInvalidatedByPlanChange(
      projection.graftPlanId,
      projection.graftPlanVersion,
      ctx.currentApprovedPlan
    )
  ) {
    reasons.push("approved_graft_plan_changed");
  }

  if (ctx.frozenSourceRoles?.length) {
    for (const frozen of ctx.frozenSourceRoles) {
      const current = ctx.currentSourceReviews.find((r) => r.imageId === frozen.imageId);
      if (!current) {
        reasons.push("source_image_role_or_orientation_changed");
        break;
      }
      if (current.assignedRole !== frozen.role) {
        reasons.push("source_image_role_or_orientation_changed");
        break;
      }
      const curOrient = (current as { orientation?: string | null }).orientation ?? null;
      const curMirror = (current as { mirrored?: boolean | null }).mirrored ?? null;
      if (
        (frozen.orientation != null && curOrient !== frozen.orientation) ||
        (frozen.mirrored != null && curMirror !== frozen.mirrored)
      ) {
        reasons.push("source_image_role_or_orientation_changed");
        break;
      }
    }
  }

  if (ctx.frozenAnnotationIds?.length) {
    const live = new Set(
      ctx.currentAnnotations
        .filter((a) => a.approved && !a.deletedAt)
        .map((a) => a.id)
    );
    const missing = ctx.frozenAnnotationIds.some((id) => !live.has(id));
    const extraDeleted = ctx.currentAnnotations.some(
      (a) => ctx.frozenAnnotationIds!.includes(a.id) && (a.deletedAt || !a.approved)
    );
    if (missing || extraDeleted) {
      reasons.push("relevant_annotation_changed");
    }
  }

  if (ctx.frozenObservationIds?.length) {
    const live = new Set(
      ctx.currentObservations
        .filter((o) => o.status === "confirmed" || o.status === "corrected")
        .map((o) => o.id)
    );
    if (ctx.frozenObservationIds.some((id) => !live.has(id))) {
      reasons.push("approved_observations_changed");
    }
  }

  const policyVersion =
    ctx.currentPolicyVersion ?? PRE_SURGERY_PROJECTION_GENERATION_POLICY_VERSION;
  if (
    projection.generationPolicyVersion &&
    projection.generationPolicyVersion !== policyVersion
  ) {
    reasons.push("projection_policy_version_changed");
  }

  if (
    projection.providerId &&
    ctx.retiredProviderIds?.includes(projection.providerId)
  ) {
    reasons.push("provider_or_model_retired");
  }
  if (
    projection.providerModelVersion &&
    ctx.retiredModelVersions?.includes(projection.providerModelVersion)
  ) {
    reasons.push("provider_or_model_retired");
  }

  if (!ctx.caseEligible) {
    reasons.push("case_no_longer_eligible");
  }

  if (ctx.patientSharingRevoked) {
    reasons.push("patient_sharing_revoked");
  }

  if (projection.staleAt) {
    return {
      stale: true,
      reasons: projection.staleReasons?.length
        ? projection.staleReasons
        : reasons.length
          ? reasons
          : ["manual"],
    };
  }

  if (reasons.length === 0) return { stale: false };
  return { stale: true, reasons: [...new Set(reasons)] };
}

/**
 * Mark a projection stale: revoke sharing, keep history auditable.
 * Does not delete the attempt. Prefer `expired` only when share window ends;
 * staleness uses soft flags so approved history remains reviewable.
 */
export function markProjectionStale(
  projection: PreSurgeryIllustrativeProjection,
  reasons: ProjectionStaleReason[],
  now = new Date().toISOString()
): PreSurgeryIllustrativeProjection {
  return {
    ...projection,
    patientSharingEnabled: false,
    staleAt: now,
    staleReasons: reasons,
  };
}

/** True when a projection must not be newly shared or newly pinned to a report. */
export function isProjectionStaleForSharing(
  projection: PreSurgeryIllustrativeProjection,
  ctx?: StalenessContext
): boolean {
  if (projection.staleAt) return true;
  if (projection.status === "superseded" || projection.status === "expired") return true;
  if (!ctx) return false;
  return evaluateProjectionStaleness(projection, ctx).stale;
}
