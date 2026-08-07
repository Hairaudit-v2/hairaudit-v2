/**
 * HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B — Require approved Proposed Hairline Design
 * before Illustrative Projected Outcome generation.
 */

import type {
  ClinicalImageAnnotation,
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
} from "../types";
import { resolveProjectionArtifactType } from "./artifactTypes";

export type HairlineApprovalGateResult =
  | {
      ok: true;
      hairlineDesignId: string;
      hairlineVersion: number;
      source: "approved_hairline_artifact" | "approved_annotation_bound";
    }
  | { ok: false; code: string; message: string };

/**
 * Outcome generation requires an approved, plan-bound hairline design.
 * Prefer a versioned proposed_hairline_design projection; fall back to an approved
 * proposed_hairline annotation on the frontal source when a design artifact is pending
 * but the clinician has confirmed the annotation (pilot bootstrap).
 */
export function assertApprovedHairlineDesignForOutcome(input: {
  projections: PreSurgeryIllustrativeProjection[];
  plan: PreSurgeryGraftPlan;
  annotations: ClinicalImageAnnotation[];
  sourceImageId?: string | null;
  /** When true, allow approved annotation alone for pilot if no design artifact yet. */
  allowApprovedAnnotationFallback?: boolean;
}): HairlineApprovalGateResult {
  const designArtifacts = input.projections
    .filter((p) => {
      const t = resolveProjectionArtifactType({
        artifactType: p.artifactType,
        providerId: p.providerId,
      });
      return t === "proposed_hairline_design";
    })
    .filter((p) => p.status === "approved")
    .filter((p) => p.graftPlanId === input.plan.id && p.graftPlanVersion === input.plan.version)
    .sort((a, b) => (b.projectionVersion ?? 1) - (a.projectionVersion ?? 1));

  const design = designArtifacts[0];
  if (design) {
    return {
      ok: true,
      hairlineDesignId: design.id,
      hairlineVersion: design.projectionVersion ?? 1,
      source: "approved_hairline_artifact",
    };
  }

  const approvedHairlineAnn = input.annotations.find(
    (a) =>
      a.annotationType === "proposed_hairline" &&
      a.approved &&
      !a.deletedAt &&
      a.coordinates.length >= 2 &&
      (!input.sourceImageId || a.imageId === input.sourceImageId)
  );

  if (input.allowApprovedAnnotationFallback !== false && approvedHairlineAnn) {
    // Pilot path: annotation approved but versioned design artifact not yet minted —
    // still require the caller to mint/approve a design artifact for a hard gate in
    // production. For 2B pilot we accept confirmed annotation + plan binding as the
    // "visibly reviewed" prerequisite when generating the design record in the same flow.
    return {
      ok: true,
      hairlineDesignId: approvedHairlineAnn.id,
      hairlineVersion: 1,
      source: "approved_annotation_bound",
    };
  }

  return {
    ok: false,
    code: "hairline_design_not_approved",
    message:
      "Generate and approve a Proposed Hairline Design bound to the current surgical plan before creating an Illustrative Projected Outcome.",
  };
}
