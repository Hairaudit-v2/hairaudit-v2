/**
 * HA-PROJECTION-1A — Canonical surgery-day procedure reconstruction types.
 *
 * Assessment classification is separate from PatientReviewPathway.
 * 1A implements only the two surgery-day reconstruction assessment types.
 */

/** Full assessment taxonomy (1A implements reconstruction values only). */
export type HairAuditAssessmentType =
  | "pre_surgery_planning"
  | "surgery_day_reconstruction"
  | "surgery_day_reconstruction_with_baseline"
  | "early_postop_assessment"
  | "post_surgery_outcome";

export type SurgeryDayReconstructionAssessmentType =
  | "surgery_day_reconstruction"
  | "surgery_day_reconstruction_with_baseline";

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
