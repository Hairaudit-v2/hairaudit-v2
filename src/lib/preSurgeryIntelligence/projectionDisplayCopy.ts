/**
 * HA-PRE-SURGERY-PROJECTION-LIVE-ACCEPTANCE-1B — Display terminology for planning composites
 * vs genuine ImagingOS cosmetic outcome simulations.
 *
 * local-illustrative-v1 produces an Illustrative Surgery Plan (planning composite).
 * Reserve "Projected Outcome" for ImagingOS simulations that incorporate density, survival,
 * calibre, curl, contrast and native-hair assumptions.
 */

export const ILLUSTRATIVE_SURGERY_PLAN_LABEL = "Illustrative Surgery Plan" as const;

export const ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT =
  "This planning illustration shows the proposed hairline and treatment zones. It is not a guarantee or photorealistic prediction of the final result." as const;

/** Reserved for genuine ImagingOS cosmetic hair-growth simulations — do not use for local-illustrative. */
export const PROJECTED_OUTCOME_LABEL = "Projected Outcome" as const;

export function labelForProjectionProvider(providerId: string | null | undefined): {
  label: typeof ILLUSTRATIVE_SURGERY_PLAN_LABEL | typeof PROJECTED_OUTCOME_LABEL;
  supportingText: string;
  isCosmeticallySimulated: boolean;
} {
  const id = (providerId ?? "").toLowerCase();
  if (id.startsWith("imagingos")) {
    return {
      label: PROJECTED_OUTCOME_LABEL,
      supportingText:
        "This projected outcome is an ImagingOS cosmetic simulation incorporating graft density, survival, calibre, curl, contrast and native-hair assumptions. It is still not a guaranteed result.",
      isCosmeticallySimulated: true,
    };
  }
  return {
    label: ILLUSTRATIVE_SURGERY_PLAN_LABEL,
    supportingText: ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT,
    isCosmeticallySimulated: false,
  };
}
