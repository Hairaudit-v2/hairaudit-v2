/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Structured observation helpers.
 */

import { PRE_SURGERY_OBSERVATION_VERSION } from "./versions";
import {
  OBSERVATION_DOMAINS,
  type ClinicalObservation,
  type ObservationDomain,
  type ObservationReviewStatus,
} from "./types";

export const OBSERVATION_DOMAIN_LABELS: Record<ObservationDomain, string> = {
  pattern_classification: "Pattern classification",
  frontal_recession: "Frontal recession",
  temple_recession: "Temple recession",
  frontal_tuft_preservation: "Frontal tuft preservation",
  forelock_preservation: "Forelock preservation",
  mid_scalp_density: "Mid-scalp density",
  crown_involvement: "Crown involvement",
  miniaturisation_pattern: "Miniaturisation pattern",
  visible_scalp_contrast: "Visible scalp contrast",
  donor_density_appearance: "Donor density appearance",
  donor_calibre_appearance: "Donor calibre appearance",
  donor_uniformity: "Donor uniformity",
  retrograde_thinning_concern: "Retrograde thinning concern",
  diffuse_unpatterned_thinning_concern: "Diffuse unpatterned thinning concern",
  scarring_concern: "Scarring concern",
  previous_extraction_evidence: "Previous extraction evidence",
  image_limitation: "Image limitation",
  likely_treatment_zones: "Likely treatment zones",
  suitability_uncertainty: "Suitability uncertainty",
};

/** Bounded choice sets for clinician controls (no free-form diagnosis). */
export const OBSERVATION_CHOICE_SETS: Partial<Record<ObservationDomain, readonly string[]>> = {
  pattern_classification: [
    "Norwood-like patterned",
    "Diffuse / unpatterned concern",
    "Mixed pattern",
    "Unable to assess from these images",
  ],
  frontal_recession: ["None / minimal", "Mild", "Moderate", "Advanced", "Unable to assess from these images"],
  temple_recession: ["Symmetric mild", "Asymmetric", "Advanced", "Preserved", "Unable to assess from these images"],
  frontal_tuft_preservation: ["Preserved", "Partial", "Absent", "Unable to assess from these images"],
  forelock_preservation: ["Preserved", "Partial", "Absent", "Unable to assess from these images"],
  mid_scalp_density: ["Adequate", "Thinning", "Sparse", "Unable to assess from these images"],
  crown_involvement: ["None", "Early", "Moderate", "Advanced", "Unable to assess from these images"],
  donor_density_appearance: ["Favourable", "Moderate", "Cautious", "Apparently limited", "Unable to assess from these images"],
  donor_calibre_appearance: ["Fine", "Medium", "Coarse", "Unable to assess from these images"],
  donor_uniformity: ["Uniform", "Patchy", "Unable to assess from these images"],
  retrograde_thinning_concern: ["Not suggested", "Possible concern", "Unable to assess from these images"],
  diffuse_unpatterned_thinning_concern: ["Not suggested", "Possible concern", "Unable to assess from these images"],
  scarring_concern: ["Not visible", "Possible scar", "Clear scar", "Unable to assess from these images"],
  previous_extraction_evidence: ["Not visible", "Possible", "Likely", "Unable to assess from these images"],
  suitability_uncertainty: ["Low", "Moderate", "High", "Unable to assess from these images"],
};

export type SeedObservationsInput = {
  caseId: string;
  evidenceImageIds?: string[];
  /** Optional AI-proposed values by domain (structured only — no hidden prompts). */
  aiProposals?: Partial<Record<ObservationDomain, { value: ClinicalObservation["aiProposedValue"]; confidence?: number | null }>>;
  now?: string;
};

export function seedPendingObservations(input: SeedObservationsInput): ClinicalObservation[] {
  const now = input.now ?? new Date().toISOString();
  const evidence = input.evidenceImageIds ?? [];
  return OBSERVATION_DOMAINS.map((domain) => {
    const proposal = input.aiProposals?.[domain];
    return {
      id: crypto.randomUUID(),
      caseId: input.caseId,
      domain,
      schemaVersion: PRE_SURGERY_OBSERVATION_VERSION,
      aiProposedValue: proposal?.value ?? null,
      aiConfidence: proposal?.confidence ?? null,
      evidenceImageIds: evidence,
      clinicianApprovedValue: null,
      note: null,
      status: "pending_review" as ObservationReviewStatus,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function applyObservationReview(
  observation: ClinicalObservation,
  patch: {
    clinicianApprovedValue?: ClinicalObservation["clinicianApprovedValue"];
    note?: string | null;
    status: ObservationReviewStatus;
  },
  reviewedBy: string,
  now = new Date().toISOString()
): ClinicalObservation {
  const approved =
    patch.clinicianApprovedValue !== undefined
      ? patch.clinicianApprovedValue
      : observation.clinicianApprovedValue;
  let status = patch.status;
  if (status === "confirmed" || status === "corrected") {
    const ai = observation.aiProposedValue;
    const same =
      JSON.stringify(ai) === JSON.stringify(approved) ||
      (approved == null && ai == null);
    if (status === "confirmed" && !same && approved != null) status = "corrected";
  }
  return {
    ...observation,
    clinicianApprovedValue: approved,
    note: patch.note !== undefined ? patch.note : observation.note,
    status,
    reviewedBy,
    reviewedAt: now,
    updatedAt: now,
  };
}
