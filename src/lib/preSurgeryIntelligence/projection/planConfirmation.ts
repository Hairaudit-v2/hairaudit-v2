/**
 * HA-PRE-SURGERY-PROJECTION-REAL-ASSET-1A — Current-plan confirmation before generation.
 */

import type { ClinicalImageReview, PreSurgeryGraftPlan } from "../types";
import { computeGraftPlanTotals } from "../graftPlanTotals";
import { isProjectionSourceRole } from "../imageRoles";

export type ProjectionPlanConfirmationPayload = {
  confirmCurrentApprovedPlan: boolean;
  /** Explicitly allow generating from a superseded/historical plan. */
  allowSupersededPlan?: boolean;
  graftPlanId?: string | null;
};

export type ProjectionPlanPreview = {
  planId: string;
  planVersion: number;
  approvalStatus: PreSurgeryGraftPlan["status"];
  totalMinimumGrafts: number;
  totalTargetGrafts: number;
  totalMaximumGrafts: number;
  zoneAllocations: Array<{
    zone: string;
    priority: string;
    minimumGrafts: number;
    targetGrafts: number;
    maximumGrafts: number;
  }>;
  sourceImageViews: Array<{
    imageId: string;
    assignedRole: string;
    reviewStatus: string;
  }>;
  isCurrentApproved: boolean;
  isSuperseded: boolean;
};

export function buildProjectionPlanPreview(input: {
  plan: PreSurgeryGraftPlan;
  currentApprovedPlan: PreSurgeryGraftPlan | null;
  imageReviews: ClinicalImageReview[];
}): ProjectionPlanPreview {
  const totals = computeGraftPlanTotals(input.plan.zones);
  const isCurrentApproved =
    input.currentApprovedPlan != null &&
    input.plan.id === input.currentApprovedPlan.id &&
    input.plan.version === input.currentApprovedPlan.version &&
    input.plan.status === "approved";

  return {
    planId: input.plan.id,
    planVersion: input.plan.version,
    approvalStatus: input.plan.status,
    totalMinimumGrafts: totals.totalMinimumGrafts,
    totalTargetGrafts: totals.totalTargetGrafts,
    totalMaximumGrafts: totals.totalMaximumGrafts,
    zoneAllocations: input.plan.zones.map((z) => ({
      zone: z.zone,
      priority: z.priority,
      minimumGrafts: z.minimumGrafts,
      targetGrafts: z.targetGrafts,
      maximumGrafts: z.maximumGrafts,
    })),
    sourceImageViews: input.imageReviews
      .filter((r) => isProjectionSourceRole(r.assignedRole))
      .map((r) => ({
        imageId: r.imageId,
        assignedRole: r.assignedRole,
        reviewStatus: r.reviewStatus,
      })),
    isCurrentApproved,
    isSuperseded: input.plan.status === "superseded" || (!isCurrentApproved && input.plan.status !== "approved"),
  };
}

export type ResolvePlanForProjectionResult =
  | { ok: true; plan: PreSurgeryGraftPlan; preview: ProjectionPlanPreview }
  | {
      ok: false;
      code: string;
      message: string;
      preview?: ProjectionPlanPreview;
    };

/**
 * Defaults to the latest approved plan. Blocks superseded plans unless explicitly selected
 * for historical review and acknowledge via allowSupersededPlan.
 */
export function resolvePlanForProjectionGeneration(input: {
  graftPlans: PreSurgeryGraftPlan[];
  requestedGraftPlanId?: string | null;
  confirmation: ProjectionPlanConfirmationPayload;
  imageReviews: ClinicalImageReview[];
}): ResolvePlanForProjectionResult {
  const approvedNewest = [...input.graftPlans]
    .filter((p) => p.status === "approved")
    .sort((a, b) => b.version - a.version)[0] ?? null;

  const requested = input.requestedGraftPlanId
    ? input.graftPlans.find((p) => p.id === input.requestedGraftPlanId) ?? null
    : null;

  const plan = requested ?? approvedNewest;
  if (!plan) {
    return {
      ok: false,
      code: "no_approved_plan",
      message: "An approved graft plan is required before projection generation",
    };
  }

  const preview = buildProjectionPlanPreview({
    plan,
    currentApprovedPlan: approvedNewest,
    imageReviews: input.imageReviews,
  });

  if (plan.status !== "approved" && plan.status !== "superseded") {
    return {
      ok: false,
      code: "plan_not_approved",
      message: `Plan v${plan.version} is ${plan.status}; only approved (or explicitly selected superseded) plans may be used`,
      preview,
    };
  }

  const usingNonCurrent =
    !approvedNewest ||
    plan.id !== approvedNewest.id ||
    plan.version !== approvedNewest.version ||
    plan.status === "superseded";

  if (usingNonCurrent && !input.confirmation.allowSupersededPlan) {
    return {
      ok: false,
      code: "superseded_plan_blocked",
      message: approvedNewest
        ? `Generation defaults to the latest approved plan (v${approvedNewest.version}). Superseded plan v${plan.version} requires explicit historical selection.`
        : `Plan v${plan.version} is not the current approved plan`,
      preview,
    };
  }

  if (!input.confirmation.confirmCurrentApprovedPlan) {
    return {
      ok: false,
      code: "plan_confirmation_required",
      message: approvedNewest
        ? `Clinician confirmation is required that plan v${usingNonCurrent ? plan.version : approvedNewest.version} is the intended source`
        : "Clinician confirmation of the intended graft plan is required",
      preview,
    };
  }

  if (plan.status !== "approved" && !(usingNonCurrent && input.confirmation.allowSupersededPlan)) {
    return {
      ok: false,
      code: "plan_not_approved",
      message: "An approved graft plan is required before projection generation",
      preview,
    };
  }

  // Historical superseded review: allowed only with explicit flag (status may be superseded).
  if (plan.status === "superseded" && input.confirmation.allowSupersededPlan) {
    return { ok: true, plan, preview };
  }

  if (plan.status !== "approved") {
    return {
      ok: false,
      code: "plan_not_approved",
      message: "An approved graft plan is required before projection generation",
      preview,
    };
  }

  return { ok: true, plan, preview };
}
