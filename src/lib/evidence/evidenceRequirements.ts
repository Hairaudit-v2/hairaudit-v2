/**
 * Evidence Intelligence: required / optional image evidence per surgical metric.
 * Additive layer — does not replace audit scoring or photo schemas.
 */

export type EvidenceRequirementKey =
  | "recipient_day0_macro"
  | "recipient_day0_angle"
  | "recipient_mid_range"
  | "hairline_frontal_macro"
  | "hairline_oblique"
  | "extraction_phase_closeup"
  | "graft_macro"
  | "donor_preop"
  | "donor_shaved_macro"
  | "donor_postop_shaved"
  | "donor_healed"
  | "graft_tray_overview"
  | "graft_tray_closeup";

export type SurgicalMetricId =
  | "implant_density"
  | "hairline_naturalness"
  | "transection_risk"
  | "donor_quality"
  | "donor_scar_visibility"
  | "graft_handling";

export type MetricEvidenceRequirement = {
  readonly required: readonly EvidenceRequirementKey[];
  readonly optional?: readonly EvidenceRequirementKey[];
  /** Minimum distinct required evidence keys that must be satisfied; defaults to `required.length`. */
  readonly min_required?: number;
};

export const EVIDENCE_REQUIREMENTS: Record<SurgicalMetricId, MetricEvidenceRequirement> = {
  implant_density: {
    required: ["recipient_day0_macro", "recipient_day0_angle"],
    optional: ["recipient_mid_range"],
    min_required: 2,
  },
  hairline_naturalness: {
    required: ["hairline_frontal_macro", "hairline_oblique"],
    min_required: 2,
  },
  transection_risk: {
    required: ["extraction_phase_closeup"],
    optional: ["graft_macro"],
  },
  donor_quality: {
    required: ["donor_preop", "donor_shaved_macro"],
  },
  donor_scar_visibility: {
    required: ["donor_postop_shaved", "donor_healed"],
  },
  graft_handling: {
    required: ["graft_tray_overview", "graft_tray_closeup"],
  },
};

export function minRequiredForMetric(def: MetricEvidenceRequirement): number {
  return def.min_required ?? def.required.length;
}
