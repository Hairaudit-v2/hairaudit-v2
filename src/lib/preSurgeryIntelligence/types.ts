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
  | "projection_generated"
  | "projection_rejected"
  | "projection_approved"
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

/** Patient-facing labels — never use guaranteed / final-result language. */
export const PRE_SURGERY_PROJECTION_PATIENT_LABELS: Record<PreSurgeryProjectionMode, string> = {
  conservative: "Illustrative conservative projection",
  planned: "Illustrative planned projection",
  optimistic_within_approved_range: "Illustrative upper-range projection",
};

export type PreSurgeryProjectionStatus =
  | "pending"
  | "generated"
  | "validation_failed"
  | "rejected"
  | "approved"
  | "superseded";

export type PreSurgeryProjectionValidationCheck =
  | "identity_consistency"
  | "image_alignment"
  | "treatment_zone_compliance"
  | "hairline_boundary"
  | "graft_range_plausibility"
  | "deferred_zone_compliance"
  | "source_image_quality";

export type PreSurgeryProjectionValidationResult = {
  check: PreSurgeryProjectionValidationCheck;
  passed: boolean;
  detail: string;
};

export type PreSurgeryIllustrativeProjection = {
  id: string;
  caseId: string;
  graftPlanId: string;
  graftPlanVersion: number;
  sourceImageId: string;
  mode: PreSurgeryProjectionMode;
  patientSafeLabel: string;
  status: PreSurgeryProjectionStatus;
  engineVersion: PreSurgeryProjectionEngineVersion | string;
  generationVersion: string;
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
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  inputChecksum: string;
  outputChecksum: string | null;
};
