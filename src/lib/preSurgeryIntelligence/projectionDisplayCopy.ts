/**
 * HA-PRE-SURGERY-PHOTOREALISTIC-OUTCOME-2A / OPENAI-IMAGE-PROVIDER-2B — Display terminology.
 *
 * Graft Allocation Map / Proposed Hairline Design = overlay planning aids (local-illustrative).
 * Illustrative Projected Outcome = photoreal cosmetic simulation (OpenAI gpt-image / ImagingOS).
 */

import {
  ARTIFACT_TYPE_LABELS,
  ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER,
  resolveProjectionArtifactType,
  type PreSurgeryArtifactType,
} from "./projection/artifactTypes";

/** @deprecated Prefer ARTIFACT_TYPE_LABELS.graft_allocation_map */
export const ILLUSTRATIVE_SURGERY_PLAN_LABEL = ARTIFACT_TYPE_LABELS.graft_allocation_map;

export const ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT =
  "Colour-coded clinical planning overlay showing proposed treatment zones and graft allocation. Not a projected cosmetic result." as const;

export const PROPOSED_HAIRLINE_DESIGN_SUPPORTING_TEXT =
  "Intended hairline boundary on the source photograph. Precise line or subtle translucent guidance — not opaque density blocks." as const;

export const PROJECTED_OUTCOME_LABEL = ARTIFACT_TYPE_LABELS.illustrative_projected_outcome;

export function labelForProjectionProvider(providerId: string | null | undefined): {
  label: string;
  supportingText: string;
  isCosmeticallySimulated: boolean;
  artifactType: PreSurgeryArtifactType;
} {
  const provider = (providerId ?? "").toLowerCase();
  // OpenAI cosmetic image-edit outcomes use the same patient-safe disclaimer as ImagingOS.
  if (provider.startsWith("openai")) {
    return {
      label: PROJECTED_OUTCOME_LABEL,
      supportingText: ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER,
      isCosmeticallySimulated: true,
      artifactType: "illustrative_projected_outcome",
    };
  }
  const artifactType = resolveProjectionArtifactType({ providerId });
  if (artifactType === "illustrative_projected_outcome") {
    return {
      label: PROJECTED_OUTCOME_LABEL,
      supportingText: ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER,
      isCosmeticallySimulated: true,
      artifactType,
    };
  }
  if (artifactType === "proposed_hairline_design") {
    return {
      label: ARTIFACT_TYPE_LABELS.proposed_hairline_design,
      supportingText: PROPOSED_HAIRLINE_DESIGN_SUPPORTING_TEXT,
      isCosmeticallySimulated: false,
      artifactType,
    };
  }
  return {
    label: ARTIFACT_TYPE_LABELS.graft_allocation_map,
    supportingText: ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT,
    isCosmeticallySimulated: false,
    artifactType,
  };
}

export function labelForProjectionArtifact(input: {
  artifactType?: string | null;
  providerId?: string | null;
}): {
  label: string;
  supportingText: string;
  isCosmeticallySimulated: boolean;
  artifactType: PreSurgeryArtifactType;
} {
  const artifactType = resolveProjectionArtifactType(input);
  if (artifactType === "illustrative_projected_outcome") {
    return {
      label: PROJECTED_OUTCOME_LABEL,
      supportingText: ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER,
      isCosmeticallySimulated: true,
      artifactType,
    };
  }
  if (artifactType === "proposed_hairline_design") {
    return {
      label: ARTIFACT_TYPE_LABELS.proposed_hairline_design,
      supportingText: PROPOSED_HAIRLINE_DESIGN_SUPPORTING_TEXT,
      isCosmeticallySimulated: false,
      artifactType,
    };
  }
  return {
    label: ARTIFACT_TYPE_LABELS.graft_allocation_map,
    supportingText: ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT,
    isCosmeticallySimulated: false,
    artifactType,
  };
}
