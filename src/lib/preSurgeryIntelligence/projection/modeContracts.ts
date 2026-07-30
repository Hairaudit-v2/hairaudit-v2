/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Explicit projection mode contracts.
 * Modes fail validation rather than silently producing reduced/misleading output.
 */

import type { PreSurgeryImageRole } from "../imageRoles";
import type { GraftPlanZone, PreSurgeryGraftPlan, PreSurgeryProjectionMode } from "../types";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "../types";
import { activeZoneRows } from "../graftPlanTotals";
import { isProjectionSourceRole } from "../imageRoles";

export type ProjectionModeContract = {
  mode: PreSurgeryProjectionMode;
  requiredSourceViews: PreSurgeryImageRole[];
  eligiblePlanningZones: GraftPlanZone[];
  mayIllustrateDensity: boolean;
  mayIllustrateCoverage: boolean;
  mayIllustrateHairlineGeometry: boolean;
  prohibitedVisualElements: string[];
  patientSafeDisclaimer: string;
  clinicianEditingAfterGenerationPermitted: boolean;
};

export const PROJECTION_MODE_CONTRACTS: Record<PreSurgeryProjectionMode, ProjectionModeContract> = {
  conservative: {
    mode: "conservative",
    requiredSourceViews: ["frontal", "frontal_hairline", "top"],
    eligiblePlanningZones: [
      "hairline",
      "left_temple",
      "right_temple",
      "frontal_tuft",
      "forelock",
      "frontal_third",
      "mid_scalp",
      "crown",
      "scar",
      "other",
    ],
    mayIllustrateDensity: true,
    mayIllustrateCoverage: true,
    mayIllustrateHairlineGeometry: true,
    prohibitedVisualElements: [
      "guaranteed_density_overlay",
      "filled_deferred_zones",
      "donor_overfill",
      "facial_identity_change",
      "exact_future_growth_claim",
      "upper_range_fill",
    ],
    patientSafeDisclaimer:
      "Illustrative conservative planning image based on the current clinical plan. Not a guarantee of density, growth, survival, or final appearance.",
    clinicianEditingAfterGenerationPermitted: false,
  },
  planned: {
    mode: "planned",
    requiredSourceViews: ["frontal", "frontal_hairline", "top"],
    eligiblePlanningZones: [
      "hairline",
      "left_temple",
      "right_temple",
      "frontal_tuft",
      "forelock",
      "frontal_third",
      "mid_scalp",
      "crown",
      "scar",
      "other",
    ],
    mayIllustrateDensity: true,
    mayIllustrateCoverage: true,
    mayIllustrateHairlineGeometry: true,
    prohibitedVisualElements: [
      "guaranteed_density_overlay",
      "filled_deferred_zones",
      "facial_identity_change",
      "exact_future_growth_claim",
      "predicted_result_label",
    ],
    patientSafeDisclaimer:
      "Illustrative planned projection based on the current clinical plan. Not a guarantee of density, growth, survival, or final appearance. Subject to donor capacity, healing, hair characteristics, future loss, treatment adherence, and clinical factors.",
    clinicianEditingAfterGenerationPermitted: false,
  },
  optimistic_within_approved_range: {
    mode: "optimistic_within_approved_range",
    requiredSourceViews: ["frontal", "frontal_hairline", "top"],
    eligiblePlanningZones: [
      "hairline",
      "left_temple",
      "right_temple",
      "frontal_tuft",
      "forelock",
      "frontal_third",
      "mid_scalp",
      "crown",
      "scar",
      "other",
    ],
    mayIllustrateDensity: true,
    mayIllustrateCoverage: true,
    mayIllustrateHairlineGeometry: true,
    prohibitedVisualElements: [
      "guaranteed_density_overlay",
      "filled_deferred_zones",
      "beyond_approved_maximum",
      "facial_identity_change",
      "exact_future_growth_claim",
      "expected_result_label",
    ],
    patientSafeDisclaimer:
      "Illustrative upper-range projection within the approved graft plan. Not a guarantee of density, growth, survival, or final appearance.",
    clinicianEditingAfterGenerationPermitted: false,
  },
};

export type ModeContractValidationIssue = {
  code: string;
  message: string;
};

/**
 * Validate that the requested mode can be produced from available inputs.
 * Fail closed — never silently degrade to a misleading representation.
 */
export function validateProjectionModeContract(input: {
  mode: PreSurgeryProjectionMode;
  plan: PreSurgeryGraftPlan;
  availableRoles: PreSurgeryImageRole[];
}): ModeContractValidationIssue[] {
  const contract = PROJECTION_MODE_CONTRACTS[input.mode];
  const issues: ModeContractValidationIssue[] = [];

  const hasEligibleSource = input.availableRoles.some((r) => isProjectionSourceRole(r));
  if (!hasEligibleSource) {
    issues.push({
      code: "mode_required_source_missing",
      message: `Mode ${input.mode} requires an eligible frontal or top source view`,
    });
  }

  const active = activeZoneRows(input.plan.zones);
  if (active.length === 0) {
    issues.push({
      code: "mode_no_eligible_zones",
      message: `Mode ${input.mode} cannot run with zero eligible planning zones`,
    });
  }

  const ineligible = active.filter((z) => !contract.eligiblePlanningZones.includes(z.zone));
  if (ineligible.length > 0) {
    issues.push({
      code: "mode_ineligible_zones",
      message: `Mode ${input.mode} cannot illustrate zones: ${ineligible.map((z) => z.zone).join(", ")}`,
    });
  }

  for (const z of input.plan.zones.filter((row) => row.priority === "defer")) {
    if (z.minimumGrafts > 0 || z.targetGrafts > 0 || z.maximumGrafts > 0) {
      issues.push({
        code: "mode_deferred_zone_has_grafts",
        message: `Deferred zone ${z.zone} must not carry graft targets for projection`,
      });
    }
  }

  return issues;
}

export function patientSafeDisclaimerForMode(mode: PreSurgeryProjectionMode): string {
  return PROJECTION_MODE_CONTRACTS[mode].patientSafeDisclaimer;
}

export function patientSafeLabelForMode(mode: PreSurgeryProjectionMode): string {
  return PRE_SURGERY_PROJECTION_PATIENT_LABELS[mode];
}
