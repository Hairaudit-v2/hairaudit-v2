/**
 * HA-PRE-SURGERY-PHOTOREALISTIC-OUTCOME-2A — Product separation for planning overlays
 * vs photorealistic illustrative projected outcomes.
 *
 * local-illustrative-v1 may only produce Graft Allocation Maps (and Proposed Hairline Design).
 * It must never be labelled or treated as a projected cosmetic result.
 */

export const PRE_SURGERY_ARTIFACT_TYPES = [
  "graft_allocation_map",
  "proposed_hairline_design",
  "illustrative_projected_outcome",
] as const;

export type PreSurgeryArtifactType = (typeof PRE_SURGERY_ARTIFACT_TYPES)[number];

export const ARTIFACT_TYPE_LABELS: Record<PreSurgeryArtifactType, string> = {
  graft_allocation_map: "Graft Allocation Map",
  proposed_hairline_design: "Proposed Hairline Design",
  illustrative_projected_outcome: "Illustrative Projected Outcome",
};

/** Exact clinician/patient messaging when cosmetic imaging is not configured. */
export const PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE =
  "Projected-outcome generation is unavailable because the imaging provider is not configured." as const;

export const ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER =
  "This image is an illustrative projection based on the proposed surgical plan and selected assumptions. It is not a guarantee of density, growth, coverage or final appearance. Actual outcomes vary with healing, graft survival, hair characteristics, progression of native hair loss and adherence to aftercare." as const;

/** Forbidden labels for graft_allocation_map / overlay assets. */
export const FORBIDDEN_ALLOCATION_MAP_LABELS = [
  /projected result/i,
  /projected outcome/i,
  /hair-growth simulation/i,
  /hair growth simulation/i,
] as const;

export function isPreSurgeryArtifactType(value: unknown): value is PreSurgeryArtifactType {
  return (
    typeof value === "string" &&
    (PRE_SURGERY_ARTIFACT_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Resolve artifact type from payload field, then safe inference from provider.
 * Legacy local-illustrative records are Graft Allocation Maps — never projected outcomes.
 */
export function resolveProjectionArtifactType(input: {
  artifactType?: string | null;
  providerId?: string | null;
}): PreSurgeryArtifactType {
  if (isPreSurgeryArtifactType(input.artifactType)) return input.artifactType;
  const provider = (input.providerId ?? "").toLowerCase();
  if (provider.startsWith("openai") || provider.startsWith("imagingos")) {
    return "illustrative_projected_outcome";
  }
  if (provider.startsWith("local-illustrative")) return "graft_allocation_map";
  // Safe default: treat unknown overlays as allocation maps so they cannot enter
  // the patient Illustrative Projected Outcome section.
  return "graft_allocation_map";
}

export function isPatientReportOutcomeArtifact(artifactType: PreSurgeryArtifactType): boolean {
  return artifactType === "illustrative_projected_outcome";
}

export function isOverlayRendererArtifact(artifactType: PreSurgeryArtifactType): boolean {
  return (
    artifactType === "graft_allocation_map" || artifactType === "proposed_hairline_design"
  );
}

export function labelForArtifactType(artifactType: PreSurgeryArtifactType): string {
  return ARTIFACT_TYPE_LABELS[artifactType];
}

export function assertAllocationMapLabelSafe(label: string): void {
  for (const pattern of FORBIDDEN_ALLOCATION_MAP_LABELS) {
    if (pattern.test(label)) {
      throw new Error(`Allocation map label must not include: ${pattern.source}`);
    }
  }
}
