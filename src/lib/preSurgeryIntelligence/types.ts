/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Canonical domain types.
 *
 * Extends Pre-Surgery Review; does not replace HA-PROJECTION-1A–1G longitudinal stack.
 * Clinician remains final decision-maker: AI proposes → clinician confirms → system recalculates.
 */

import type { PreSurgeryImageRole } from "./imageRoles";
import type {
  PreSurgeryAnnotationVersion,
  PreSurgeryGraftPlanVersion,
  PreSurgeryImageReviewVersion,
  PreSurgeryIntelligenceSchemaVersion,
  PreSurgeryObservationVersion,
  PreSurgeryProjectionEngineVersion,
} from "./versions";

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

export type ClinicianFieldProvenance<T> = {
  originalAiValue: T | null;
  clinicianValue: T;
  reviewedBy: string;
  reviewedAt: string;
  note?: string | null;
  reason?: string | null;
  modelOrRulesetVersion: string;
  imageId?: string | null;
};

/* -------------------------------------------------------------------------- */
/* AREA 1 — Image analysis                                                    */
/* -------------------------------------------------------------------------- */

export type ImageQualityFlag =
  | "poor_lighting"
  | "blur"
  | "obstruction"
  | "inconsistent_angle"
  | "wet_or_styled_hair"
  | "scalp_camouflage_or_fibres"
  | "possible_session_mismatch";

export const IMAGE_QUALITY_FLAGS = [
  "poor_lighting",
  "blur",
  "obstruction",
  "inconsistent_angle",
  "wet_or_styled_hair",
  "scalp_camouflage_or_fibres",
  "possible_session_mismatch",
] as const satisfies readonly ImageQualityFlag[];

export type ImageClinicianReviewStatus =
  | "pending_review"
  | "confirmed"
  | "corrected"
  | "unusable"
  | "supplementary_only"
  | "replacement_requested";

export type ClinicalImageReview = {
  id: string;
  caseId: string;
  imageId: string;
  schemaVersion: PreSurgeryImageReviewVersion | string;

  /** Original classifier / pathway assignment (never overwritten). */
  originalAiRole: PreSurgeryImageRole | null;
  originalAiConfidence: number | null;
  originalAiWarnings: string[];
  originalAiObservations: string[];
  classifierModelVersion: string | null;

  assignedRole: PreSurgeryImageRole;
  orientationDegrees: 0 | 90 | 180 | 270;
  mirrored: boolean;
  qualityFlags: ImageQualityFlag[];
  reviewStatus: ImageClinicianReviewStatus;
  requiredOrOptional: "required" | "optional" | "unknown";
  imageSource: "patient" | "clinician" | "clinic" | "doctor" | "unknown";
  captureDate: string | null;
  uploaderId: string | null;
  clinicianNote: string | null;

  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicalImageReviewCorrection = {
  id: string;
  caseId: string;
  imageId: string;
  reviewId: string;
  field:
    | "assignedRole"
    | "orientationDegrees"
    | "mirrored"
    | "qualityFlags"
    | "reviewStatus"
    | "clinicianNote";
  previousValue: unknown;
  nextValue: unknown;
  originalAiValue: unknown;
  reviewedBy: string;
  reviewedAt: string;
  reason: string | null;
  modelOrRulesetVersion: string;
};

/* -------------------------------------------------------------------------- */
/* AREA 2 — Annotations                                                       */
/* -------------------------------------------------------------------------- */

export type ClinicalAnnotationType =
  | "existing_hairline"
  | "proposed_hairline"
  | "recipient_zone"
  | "donor_zone"
  | "donor_caution"
  | "frontal_tuft"
  | "forelock"
  | "temple_left"
  | "temple_right"
  | "mid_scalp"
  | "crown"
  | "scar"
  | "obscured"
  | "insufficient_evidence"
  | "custom";

export type ClinicalAnnotationGeometryType = "point" | "polyline" | "polygon";

export type NormalisedPoint = { x: number; y: number };

export type ClinicalImageAnnotation = {
  id: string;
  caseId: string;
  imageId: string;
  annotationType: ClinicalAnnotationType;
  geometryType: ClinicalAnnotationGeometryType;
  /** Normalised 0–1 coordinates relative to original image dimensions. */
  coordinates: NormalisedPoint[];
  note?: string;
  createdBy: string;
  createdAt: string;
  schemaVersion: PreSurgeryAnnotationVersion | string;
  source: "ai_suggestion" | "clinician";
  approved: boolean;
  supersedesAnnotationId?: string | null;
  deletedAt?: string | null;
  /** Original raster metadata at annotation time. */
  imageWidthPx?: number | null;
  imageHeightPx?: number | null;
  imageOrientationDegrees?: 0 | 90 | 180 | 270 | null;
};

/* -------------------------------------------------------------------------- */
/* AREA 3 — Observations                                                      */
/* -------------------------------------------------------------------------- */

export type ObservationDomain =
  | "pattern_classification"
  | "frontal_recession"
  | "temple_recession"
  | "frontal_tuft_preservation"
  | "forelock_preservation"
  | "mid_scalp_density"
  | "crown_involvement"
  | "miniaturisation_pattern"
  | "visible_scalp_contrast"
  | "donor_density_appearance"
  | "donor_calibre_appearance"
  | "donor_uniformity"
  | "retrograde_thinning_concern"
  | "diffuse_unpatterned_thinning_concern"
  | "scarring_concern"
  | "previous_extraction_evidence"
  | "image_limitation"
  | "likely_treatment_zones"
  | "suitability_uncertainty";

export const OBSERVATION_DOMAINS = [
  "pattern_classification",
  "frontal_recession",
  "temple_recession",
  "frontal_tuft_preservation",
  "forelock_preservation",
  "mid_scalp_density",
  "crown_involvement",
  "miniaturisation_pattern",
  "visible_scalp_contrast",
  "donor_density_appearance",
  "donor_calibre_appearance",
  "donor_uniformity",
  "retrograde_thinning_concern",
  "diffuse_unpatterned_thinning_concern",
  "scarring_concern",
  "previous_extraction_evidence",
  "image_limitation",
  "likely_treatment_zones",
  "suitability_uncertainty",
] as const satisfies readonly ObservationDomain[];

export type ObservationReviewStatus =
  | "pending_review"
  | "confirmed"
  | "corrected"
  | "rejected"
  | "insufficient_evidence"
  | "replacement_requested";

export type ClinicalObservation = {
  id: string;
  caseId: string;
  domain: ObservationDomain;
  schemaVersion: PreSurgeryObservationVersion | string;
  aiProposedValue: string | number | boolean | string[] | null;
  aiConfidence: number | null;
  evidenceImageIds: string[];
  clinicianApprovedValue: string | number | boolean | string[] | null;
  note: string | null;
  status: ObservationReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/* -------------------------------------------------------------------------- */
/* AREA 4 — Graft plan                                                        */
/* -------------------------------------------------------------------------- */

export type GraftPlanZone =
  | "hairline"
  | "left_temple"
  | "right_temple"
  | "frontal_tuft"
  | "forelock"
  | "frontal_third"
  | "mid_scalp"
  | "crown"
  | "scar"
  | "other";

export const GRAFT_PLAN_ZONES = [
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
] as const satisfies readonly GraftPlanZone[];

export type GraftZonePriority = "essential" | "recommended" | "optional" | "defer";

export type DonorAvailabilityBand =
  | "apparently_limited"
  | "cautious"
  | "moderate"
  | "favourable"
  | "not_assessable";

export type GraftPlanStatus = "draft" | "clinician_reviewed" | "approved" | "superseded";

export type PreSurgeryGraftPlanZoneRow = {
  zone: GraftPlanZone;
  priority: GraftZonePriority;
  minimumGrafts: number;
  targetGrafts: number;
  maximumGrafts: number;
  targetDensityGraftsPerCm2?: number;
  estimatedAreaCm2?: number;
  existingHairAdjustment?: number;
  rationale?: string;
  evidenceImageIds: string[];
};

export type PreSurgeryGraftPlan = {
  id: string;
  caseId: string;
  version: number;
  schemaVersion: PreSurgeryGraftPlanVersion | string;
  sourceAssessmentId?: string | null;
  /** When this plan was seeded from AI / rules. */
  aiSeedPlanId?: string | null;
  /** Prior clinician version this edits (same lineage). */
  previousPlanId?: string | null;

  zones: PreSurgeryGraftPlanZoneRow[];

  totalMinimumGrafts: number;
  totalTargetGrafts: number;
  totalMaximumGrafts: number;

  proposedSessionCount: 1 | 2 | 3;
  stageOneZones: GraftPlanZone[];
  deferredZones: GraftPlanZone[];

  donorAvailabilityBand: DonorAvailabilityBand;
  donorConstraintNote?: string;
  graftReserve?: number;
  planningAssumptions: string[];
  clinicianNote?: string;

  status: GraftPlanStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdBy: string;
  createdAt: string;
  checksum: string;
};

/* -------------------------------------------------------------------------- */
/* AREA 5 — Audit timeline                                                    */
/* -------------------------------------------------------------------------- */

export type PreSurgeryAuditEventType =
  | "ai_analysis_created"
  | "image_role_corrected"
  | "observation_confirmed"
  | "observation_corrected"
  | "annotation_added"
  | "annotation_deleted"
  | "graft_plan_edited"
  | "graft_plan_approved"
  | "projection_requested"
  | "projection_validation_rejected"
  | "projection_preflight_rejected"
  | "projection_activation_denied"
  | "projection_provider_request_sent"
  | "projection_provider_accepted"
  | "projection_generated"
  | "projection_timeout"
  | "projection_provider_failure"
  | "projection_output_safety_failure"
  | "projection_output_validation_failed"
  | "projection_clinician_review_opened"
  | "projection_rejected"
  | "projection_approved"
  | "projection_regeneration_requested"
  | "projection_patient_sharing_enabled"
  | "projection_patient_sharing_revoked"
  | "projection_patient_consent_recorded"
  | "projection_marked_stale"
  | "projection_superseded"
  | "projection_shadow_review_recorded"
  | "projection_included_in_report"
  | "projection_omitted_from_report"
  | "projection_correction_recorded"
  | "projection_correction_adjusted"
  | "projection_learning_signal_emitted"
  | "report_released";

export type PreSurgeryAuditEvent = {
  id: string;
  caseId: string;
  eventType: PreSurgeryAuditEventType;
  actorId: string | null;
  /** Identifiers / versions only — no PHI bodies. */
  metadata: Record<string, unknown>;
  createdAt: string;
  schemaVersion: PreSurgeryIntelligenceSchemaVersion | string;
};

/* -------------------------------------------------------------------------- */
/* AREA 6–8 — Pre-surgery illustrative projection (not longitudinal 1A–1G)   */
/* -------------------------------------------------------------------------- */

export type PreSurgeryProjectionMode = "conservative" | "planned" | "optimistic_within_approved_range";

/**
 * Patient-facing mode labels for illustrative planning.
 * Do not use “projected result / projected outcome / hair-growth simulation” for allocation maps.
 */
export const PRE_SURGERY_PROJECTION_PATIENT_LABELS: Record<PreSurgeryProjectionMode, string> = {
  conservative: "Conservative planning view",
  planned: "Planned clinical view",
  optimistic_within_approved_range: "Optimistic planning view",
};

/** Mode-bound assumptions stored with each generation (PHOTOREALISTIC-OUTCOME-2A). */
export type ProjectionModeAssumptions = {
  graftCount: number;
  recipientAreaDescription: string;
  assumedGraftSurvivalRangePct: { min: number; max: number };
  hairsPerGraftAssumption: number;
  calibre: string;
  colourToScalpContrast: string;
  curlTexture: string;
  nativeHairContribution: string;
  projectedDensityRange: { minPerCm2: number; maxPerCm2: number };
  densityHint: "modest" | "planned" | "upper_range";
  scalpVisibilityHint: "preserve_realistic" | "planned" | "reduced_but_plausible";
};

export type PreSurgeryProjectionStatus =
  | "draft_request"
  | "pending" // legacy alias of draft_request
  | "validation_failed"
  | "queued"
  | "generating"
  | "generated"
  | "clinician_review"
  | "approved"
  | "rejected"
  | "superseded"
  | "failed"
  | "expired";

export type PreSurgeryProjectionValidationCheck =
  | "identity_consistency"
  | "image_alignment"
  | "treatment_zone_compliance"
  | "hairline_boundary"
  | "graft_range_plausibility"
  | "deferred_zone_compliance"
  | "source_image_quality"
  | "mode_contract";

export type PreSurgeryProjectionValidationResult = {
  check: PreSurgeryProjectionValidationCheck;
  passed: boolean;
  detail: string;
};

export type PreSurgeryProjectionRejectionReason =
  | "incorrect_hairline"
  | "visible_mask_seam"
  | "excessive_density"
  | "unnatural_direction_or_angulation"
  | "incorrect_texture_or_colour"
  | "facial_identity_alteration"
  | "background_alteration"
  | "out_of_mask_change"
  | "native_hair_alteration"
  | "incorrect_zone_coverage"
  | "image_artefact"
  | "facial_or_scalp_distortion"
  | "donor_implication_misleading"
  | "source_image_unsuitable"
  | "plan_changed"
  | "wrong_projection_mode"
  | "other_safety_concern"
  | "other_clinical_concern";

export type PreSurgeryApprovalChecklist = {
  correctPatientAndCase: boolean;
  correctSourceImages: boolean;
  correctApprovedGraftPlanVersion: boolean;
  hairlineWithinApprovedPlan: boolean;
  coverageZonesDoNotExceedPlan: boolean;
  deferredZonesRemainVisiblyDeferred: boolean;
  donorLimitationsNotMisrepresented: boolean;
  densityNotPresentedAsGuaranteed: boolean;
  visualOutputDoesNotImplyExactFutureGrowth: boolean;
  patientSafeDisclaimerPresent: boolean;
  suitableToShare: boolean;
};

export type PreSurgeryProjectionStaleReason =
  | "approved_graft_plan_changed"
  | "source_image_role_or_orientation_changed"
  | "relevant_annotation_changed"
  | "approved_observations_changed"
  | "projection_policy_version_changed"
  | "provider_or_model_retired"
  | "case_no_longer_eligible"
  | "patient_sharing_revoked"
  | "manual";

export type PreSurgeryIllustrativeProjection = {
  id: string;
  caseId: string;
  graftPlanId: string;
  graftPlanVersion: number;
  sourceImageId: string;
  /** All source image IDs frozen at generation (2C). */
  sourceImageIds?: string[];
  mode: PreSurgeryProjectionMode;
  /**
   * PHOTOREALISTIC-OUTCOME-2A product class.
   * local-illustrative-v1 → graft_allocation_map (never illustrative_projected_outcome).
   */
  artifactType?:
    | "graft_allocation_map"
    | "proposed_hairline_design"
    | "illustrative_projected_outcome";
  /** Clinically bounded mode assumptions (required for projected-outcome modes). */
  modeAssumptions?: ProjectionModeAssumptions | null;
  patientSafeLabel: string;
  patientSafeDisclaimer?: string | null;
  status: PreSurgeryProjectionStatus;
  engineVersion: PreSurgeryProjectionEngineVersion | string;
  generationVersion: string;
  safetyLabelVersion?: string | null;
  generationPolicyVersion?: string | null;
  deterministicSeed: string | null;
  storagePath: string | null;
  validationPass: PreSurgeryProjectionValidationResult[];
  limitations: string[];
  planningAssumptions: string[];
  requestedBy: string;
  requestedAt: string;
  generatedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedRole?: string | null;
  approvedOrganisationId?: string | null;
  approvalChecklist?: PreSurgeryApprovalChecklist | null;
  approvalNote?: string | null;
  approvalOverrideReason?: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  rejectionReasonCode?: PreSurgeryProjectionRejectionReason | null;
  inputChecksum: string;
  /** Full frozen canonical request snapshot (or omit when checksum-only stored). */
  inputSnapshot?: Record<string, unknown> | null;
  outputChecksum: string | null;
  providerId?: string | null;
  providerModelVersion?: string | null;
  providerRequestId?: string | null;
  providerResponseId?: string | null;
  idempotencyKey?: string | null;
  /** Monotonic attempt / version counter for regeneration history. */
  projectionVersion?: number;
  /** Prior rejected/failed attempt this regenerates from. */
  regeneratesFromProjectionId?: string | null;
  patientSharingEnabled?: boolean;
  expiresAt?: string | null;
  supersededAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  /** 2D — set when projection is stale; remains auditable but not shareable. */
  staleAt?: string | null;
  staleReasons?: PreSurgeryProjectionStaleReason[] | null;
  /** 2D — shadow / quality-review cohort tag. */
  shadowMode?: boolean;
  qualityCohortCategory?: string | null;
  /** 2D — patient consent record id when sharing was enabled. */
  patientConsentId?: string | null;
};
