/**
 * HA-PROJECTION — Canonical surgery-day reconstruction (1A) and projected outcome (1B) types.
 *
 * Assessment classification is separate from PatientReviewPathway.
 * 1A implements reconstruction assessment values; 1B implements projection values.
 */

/** Full assessment taxonomy (implemented values grow per milestone). */
export type HairAuditAssessmentType =
  | "pre_surgery_planning"
  | "surgery_day_reconstruction"
  | "surgery_day_reconstruction_with_baseline"
  | "surgery_day_projection"
  | "surgery_day_projection_with_baseline"
  | "early_postop_assessment"
  | "post_surgery_outcome";

export type SurgeryDayReconstructionAssessmentType =
  | "surgery_day_reconstruction"
  | "surgery_day_reconstruction_with_baseline";

export type SurgeryDayProjectionAssessmentType =
  | "surgery_day_projection"
  | "surgery_day_projection_with_baseline";

export type ProjectionConfidence = "low" | "moderate" | "high";

export type ProjectedOutcomeDomain =
  | "frontal_framing"
  | "density_distribution"
  | "transition_characteristics"
  | "native_hair_dependency"
  | "untreated_or_lower_treatment_areas";

/**
 * Patient-safe projected characteristic.
 * observation / projection / confidence / limitations must remain separate fields.
 */
export type PatientSafeProjectedCharacteristic = {
  domain: ProjectedOutcomeDomain;
  title: string;
  observation: string;
  projection: string;
  confidence: ProjectionConfidence;
  sourceObservationKeys: string[];
  limitations: string[];
};

export type SurgeryDayProjectedOutcome = {
  assessmentType: SurgeryDayProjectionAssessmentType;
  reconstructionConfidence: ReconstructionConfidence;
  projectionConfidence: ProjectionConfidence;
  summary: string | null;
  projectedCharacteristics: PatientSafeProjectedCharacteristic[];
  whatCannotYetBeDetermined: string[];
  assumptions: string[];
  limitations: string[];
};

export type SurgeryDayEvidenceRole =
  | "preop_front"
  | "preop_left"
  | "preop_right"
  | "preop_top"
  | "preop_crown"
  | "preop_donor"
  | "preop_hairline_closeup"
  | "surgery_day_recipient"
  | "surgery_day_donor"
  | "surgery_day_design"
  | "surgery_day_site_creation"
  | "surgery_day_implantation"
  | "surgery_day_graft_evidence";

export type SurgeryDayReconstructionMode =
  | "surgery_day_only"
  | "baseline_plus_surgery_day";

export type ReconstructionConfidence = "low" | "moderate" | "high";

export type ObservedFeatureSource =
  | "forensic_ai"
  | "procedure_metadata"
  | "auditor"
  | "rule"
  | "mixed"
  /** Reserved for HA-PROJECTION ImagingOS feature injection — not produced in 1A. */
  | "imagingos";

export type ObservedFeature = {
  key: string;
  label: string;
  observation: string;
  confidence: ReconstructionConfidence;
  evidenceRoles: SurgeryDayEvidenceRole[];
  source: ObservedFeatureSource;
};

/** Canonical anatomical vocabulary — do not invent Zone 1–4. */
export type RecipientZone =
  | "hairline"
  | "temples"
  | "frontal"
  | "forelock"
  | "mid_scalp"
  | "crown"
  | "other";

export type ProvenancedNumberSource =
  | "clinic_reported"
  | "auditor_confirmed"
  | "patient_reported"
  | "ai_estimated";

export type ProvenancedNumber = {
  value: number;
  source: ProvenancedNumberSource;
};

export type GraftEvidenceSource =
  | "clinic_reported"
  | "patient_reported"
  | "ai_estimated"
  | "mixed"
  | null;

export type SurgeryDayEvidenceAssessment = {
  mode: SurgeryDayReconstructionMode | null;
  sufficient: boolean;
  confidence: ReconstructionConfidence;
  presentRoles: SurgeryDayEvidenceRole[];
  missingRecommendedRoles: SurgeryDayEvidenceRole[];
  limitations: string[];
  /** True when at least one upload is baseline-eligible for a preop_* role. */
  baselineAvailable: boolean;
  /** Count of distinct baseline roles present (completeness, not mode gate). */
  baselineRoleCount: number;
  /** Whether surgery_day_recipient was satisfied only via any_day0 fallback. */
  usedAnyDay0Fallback: boolean;
};

export type SurgeryDayProcedureReconstruction = {
  assessmentType: SurgeryDayReconstructionAssessmentType;
  evidence: {
    confidence: ReconstructionConfidence;
    presentRoles: SurgeryDayEvidenceRole[];
    limitations: string[];
  };
  procedureContext: {
    procedureDate: string | null;
    procedureType: string | null;
    reportedGraftCount: number | null;
    actualGraftCount: number | null;
    estimatedHairCount: number | null;
    averageHairsPerGraft: number | null;
    punchSizeMm: number | null;
    extractionMethod: string | null;
    implantationMethod: string | null;
    treatedAreas: string[];
  };
  recipient: {
    observedTreatedAreas: string[];
    hairlineDesign: ObservedFeature | null;
    recipientPlacement: ObservedFeature | null;
    densityDistribution: ObservedFeature | null;
    directionAndAngulation: ObservedFeature | null;
    symmetryAndTransition: ObservedFeature | null;
  };
  donor: {
    extractionPattern: ObservedFeature | null;
    extractionDistribution: ObservedFeature | null;
    visibleConcerns: ObservedFeature[];
  } | null;
  baseline: {
    available: boolean;
    nativeHairPattern: ObservedFeature | null;
    treatmentRelationship: ObservedFeature | null;
    limitations: string[];
  };
  graftEvidence: {
    clinicReportedCount: number | null;
    imageDerivedEstimate: {
      min: number;
      max: number;
      confidence: ReconstructionConfidence;
    } | null;
    source: GraftEvidenceSource;
    /** Provenanced candidates retained when values disagree. */
    provenance: ProvenancedNumber[];
  };
  overallObservations: ObservedFeature[];
};

/** Upload shape accepted by the projection evidence resolver (does not mutate storage). */
export type ProjectionUploadInput = {
  id?: string;
  type?: string | null;
  created_at?: string | null;
  captured_at?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Optional workflow hint: patient | doctor | clinic | surgery */
  source?: string | null;
};

export type ProjectionEvidenceContext = {
  pathway?: "pre_surgery" | "post_surgery" | null;
  procedureDate?: string | null;
  /** When true, treat patient preop_* as baseline-eligible (explicit confirm). */
  baselineConfirmed?: boolean;
};

/* -------------------------------------------------------------------------- */
/* HA-PROJECTION-1E — Longitudinal observed outcome (observation-only)        */
/* -------------------------------------------------------------------------- */

/** Canonical follow-up stages. month_18 is intentionally absent (no taxonomy). */
export type LongitudinalOutcomeStage =
  | "month_3"
  | "month_6"
  | "month_9"
  | "month_12";

export type LongitudinalEvidenceRole =
  | "followup_front"
  | "followup_left"
  | "followup_right"
  | "followup_top"
  | "followup_crown"
  | "followup_donor_rear"
  | "followup_donor_closeup"
  | "followup_recipient_closeup";

export type ObservationConfidence = "low" | "moderate" | "high";

export type LongitudinalObservedFeatureSource =
  | "forensic_ai"
  | "patient_reported"
  | "clinic_reported"
  | "auditor"
  | "rule"
  | "mixed";

/**
 * Patient-safe observed feature at a follow-up stage.
 * Observation-only — no success/failure or projection-comparison semantics.
 */
export type LongitudinalObservedFeature = {
  key: string;
  label: string;
  observation: string;
  confidence: ObservationConfidence;
  evidenceRoles: LongitudinalEvidenceRole[];
  source: LongitudinalObservedFeatureSource;
};

/**
 * Canonical longitudinal outcome observation attached to a frozen 1D projection.
 * Answers only: "What can HairAudit observe at this follow-up stage?"
 */
export type LongitudinalOutcomeObservation = {
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  stage: LongitudinalOutcomeStage;
  observedAt: string;
  evidence: {
    confidence: ObservationConfidence;
    presentRoles: LongitudinalEvidenceRole[];
    limitations: string[];
  };
  recipient: {
    frontalAppearance: LongitudinalObservedFeature | null;
    densityAppearance: LongitudinalObservedFeature | null;
    transitionAppearance: LongitudinalObservedFeature | null;
    directionalAppearance: LongitudinalObservedFeature | null;
    crownAppearance: LongitudinalObservedFeature | null;
  };
  donor: {
    donorAppearance: LongitudinalObservedFeature | null;
    visibleDepletionPattern: LongitudinalObservedFeature | null;
    visibleScarring: LongitudinalObservedFeature | null;
  } | null;
  nativeHair: {
    visibleNativeHairStatus: LongitudinalObservedFeature | null;
    treatedVsUntreatedRelationship: LongitudinalObservedFeature | null;
  };
  healing: {
    visibleHealingStatus: LongitudinalObservedFeature | null;
    visibleConcerns: LongitudinalObservedFeature[];
  };
  overallObservations: LongitudinalObservedFeature[];
  limitations: string[];
};

/** Case/upload context for longitudinal stage + role resolution. */
export type LongitudinalEvidenceContext = {
  procedureDate?: string | null;
  /** Intake months_since band when known (under_3, 3_6, 6_9, 9_12, 12_plus). */
  monthsSinceBand?: string | null;
  /** Numeric months since procedure when known. */
  monthsSinceProcedure?: number | null;
  /** Explicit stage override from trusted workflow (rare). */
  declaredStage?: LongitudinalOutcomeStage | null;
  /** Treated zones from frozen projection reconstruction (treatment-aware evidence). */
  treatedAreas?: string[] | null;
};

/* -------------------------------------------------------------------------- */
/* HA-PROJECTION-1F — Projected vs observed comparison                        */
/* -------------------------------------------------------------------------- */

/**
 * Canonical comparison vocabulary.
 * Characteristics only — never success/failure, better/worse, or accuracy %.
 */
export type ProjectionComparisonStatus =
  | "consistent"
  | "partially_consistent"
  | "divergent"
  | "not_yet_assessable"
  | "insufficient_evidence";

export type ComparisonConfidence = "low" | "moderate" | "high";

/**
 * Domain-level projected vs observed comparison.
 * Only domains present in the frozen 1B projection are compared.
 */
export type ProjectionDomainComparison = {
  domain: ProjectedOutcomeDomain;
  projectedCharacteristic: string;
  observedCharacteristic: string | null;
  status: ProjectionComparisonStatus;
  confidence: ComparisonConfidence;
  rationale: string;
  limitations: string[];
  projectionSourceKeys: string[];
  observationSourceKeys: string[];
};

/**
 * Canonical comparison between a frozen 1D projection and a linked 1E observation.
 */
export type ProjectionObservedComparison = {
  projectionSnapshotId: string;
  observationSnapshotId: string;
  caseId: string;
  patientId: string;
  stage: LongitudinalOutcomeStage;
  comparisonVersion: "ha-projection-comparison-v1";
  overallStatus: ProjectionComparisonStatus;
  domains: ProjectionDomainComparison[];
  summary: string | null;
  limitations: string[];
  generatedAt: string;
};
