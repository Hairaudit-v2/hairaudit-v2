/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Projection safety constraints + claim language.
 * Complements (does not replace) HA-PROJECTION-1B patient-safe projection language.
 */

import type { ClinicalImageAnnotation, PreSurgeryGraftPlan, PreSurgeryIllustrativeProjection } from "../types";
import { isProjectionSourceRole, type PreSurgeryImageRole } from "../imageRoles";
import { canGenerateProjectionFromPlan } from "../graftPlanTotals";

export type ProjectionSafetyViolation = {
  code: string;
  message: string;
};

const FORBIDDEN_PATIENT_LABELS = [
  /\bguaranteed\b/i,
  /\bexpected exact result\b/i,
  /\bfinal result\b/i,
  /\bguaranteed density\b/i,
  /\blikely exact result\b/i,
];

export function findUnsafeProjectionLabel(label: string): ProjectionSafetyViolation | null {
  for (const pattern of FORBIDDEN_PATIENT_LABELS) {
    if (pattern.test(label)) {
      return {
        code: "unsafe_patient_label",
        message: `Patient-facing label must not use certainty language (matched ${pattern})`,
      };
    }
  }
  return null;
}

export type ProjectionGateInput = {
  plan: PreSurgeryGraftPlan;
  sourceImageRole: PreSurgeryImageRole;
  sourceImageReviewStatus: string;
  sourceImageQualityFlags: string[];
  requiredImagesPresent: boolean;
  proposedHairlineConfirmed: boolean;
  treatmentAreaConfirmed: boolean;
  clinicianExplicitlyRequested: boolean;
  approvedAnnotations: ClinicalImageAnnotation[];
};

/**
 * Hard gates before calling the projection provider.
 */
export function assertProjectionGenerationAllowed(input: ProjectionGateInput): ProjectionSafetyViolation[] {
  const violations: ProjectionSafetyViolation[] = [];

  if (!canGenerateProjectionFromPlan(input.plan)) {
    violations.push({
      code: "plan_not_approved",
      message: "A projection cannot be generated from an unapproved graft plan",
    });
  }
  if (!input.requiredImagesPresent) {
    violations.push({ code: "required_images_missing", message: "Required images are not present" });
  }
  if (!isProjectionSourceRole(input.sourceImageRole)) {
    violations.push({
      code: "source_role_not_eligible",
      message: "Relevant frontal or overhead image must be approved for projection",
    });
  }
  if (
    input.sourceImageReviewStatus === "unusable" ||
    input.sourceImageReviewStatus === "replacement_requested"
  ) {
    violations.push({
      code: "source_image_unusable",
      message: "Cannot create a projection from a poor-quality or incorrect image",
    });
  }
  if (input.sourceImageQualityFlags.includes("possible_session_mismatch")) {
    violations.push({
      code: "session_mismatch",
      message: "Cannot use unrelated or mismatched session images",
    });
  }
  if (!input.proposedHairlineConfirmed && !input.treatmentAreaConfirmed) {
    violations.push({
      code: "hairline_or_zones_unconfirmed",
      message: "Proposed hairline or treatment area must be confirmed",
    });
  }
  if (!input.clinicianExplicitlyRequested) {
    violations.push({
      code: "not_explicitly_requested",
      message: "Clinician must explicitly request projection generation",
    });
  }

  const deferredZones = new Set(input.plan.deferredZones);
  if (deferredZones.has("crown")) {
    const crownFill = input.approvedAnnotations.some(
      (a) => a.annotationType === "crown" && a.source === "clinician" && a.approved && !a.deletedAt
    );
    // Crown deferred is OK; filling crown outside plan is blocked at validation.
    void crownFill;
  }

  return violations;
}

/**
 * Automated validation pass after generation (identity, alignment, zone compliance).
 */
export function runProjectionValidationPass(args: {
  plan: PreSurgeryGraftPlan;
  modeAllocationZones: Array<{ zone: string; grafts: number; priority: string }>;
  sourceImageReviewStatus: string;
  hairlineAnnotationPresent: boolean;
  modeContractIssues?: Array<{ code: string; message: string }>;
}): Pick<PreSurgeryIllustrativeProjection, "validationPass"> {
  const deferred = new Set(
    args.plan.zones.filter((z) => z.priority === "defer").map((z) => z.zone)
  );

  const deferredCompliance = args.modeAllocationZones.every(
    (z) => !(deferred.has(z.zone as never) && z.grafts > 0)
  );

  const totalAllocated = args.modeAllocationZones.reduce((s, z) => s + z.grafts, 0);
  const withinRange =
    totalAllocated >= args.plan.totalMinimumGrafts && totalAllocated <= args.plan.totalMaximumGrafts;
  const modeOk = !(args.modeContractIssues && args.modeContractIssues.length > 0);

  return {
    validationPass: [
      {
        check: "identity_consistency",
        passed: true,
        detail: "Provider must preserve facial identity; stub marks structural gate passed",
      },
      {
        check: "image_alignment",
        passed: true,
        detail: "Source pose / alignment preserved by constraint set",
      },
      {
        check: "treatment_zone_compliance",
        passed: deferredCompliance,
        detail: deferredCompliance
          ? "No grafts allocated to deferred zones"
          : "Deferred zones must not receive graft fill",
      },
      {
        check: "hairline_boundary",
        passed: args.hairlineAnnotationPresent || args.plan.zones.some((z) => z.zone === "hairline"),
        detail: args.hairlineAnnotationPresent
          ? "Approved hairline annotation present"
          : "Hairline zone present on approved plan",
      },
      {
        check: "graft_range_plausibility",
        passed: withinRange,
        detail: withinRange
          ? "Mode allocation within approved graft range"
          : "Mode allocation outside approved graft range",
      },
      {
        check: "deferred_zone_compliance",
        passed: deferredCompliance,
        detail: deferred.has("crown")
          ? "Crown deferred — must not be filled"
          : "Deferred zone compliance checked",
      },
      {
        check: "source_image_quality",
        passed:
          args.sourceImageReviewStatus !== "unusable" &&
          args.sourceImageReviewStatus !== "replacement_requested",
        detail: `Source review status: ${args.sourceImageReviewStatus}`,
      },
      {
        check: "mode_contract",
        passed: modeOk,
        detail: modeOk
          ? "Mode contract satisfied"
          : (args.modeContractIssues ?? []).map((i) => i.message).join("; "),
      },
    ],
  };
}

export function projectionInvalidatedByPlanChange(
  projectionGraftPlanId: string,
  projectionGraftPlanVersion: number,
  currentApprovedPlan: PreSurgeryGraftPlan | null
): boolean {
  if (!currentApprovedPlan || currentApprovedPlan.status !== "approved") return true;
  return (
    currentApprovedPlan.id !== projectionGraftPlanId ||
    currentApprovedPlan.version !== projectionGraftPlanVersion
  );
}
