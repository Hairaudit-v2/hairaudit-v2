/**
 * HairAudit Clinical Intelligence — versioned engine contracts (HA-INTELLIGENCE-1).
 * Advisory, image-limited outputs suitable for clinician review. Not diagnostic.
 */

export const HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION = "hairaudit.intelligence.v1" as const;

export type HairAuditIntelligenceEngineVersion = typeof HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION;

export type IntelligenceEngineId =
  | "hair_loss_classification"
  | "donor_intelligence"
  | "repair_surgery"
  | "procedural_intelligence";

/** Normalized confidence for rule-based and future model outputs. */
export type IntelligenceConfidenceBand = "very_low" | "low" | "moderate" | "high";

/** Severity for advisory concern routing — not a diagnosis. */
export type IntelligenceSeverityBand =
  | "none"
  | "minor"
  | "moderate"
  | "significant"
  | "critical";

export type EvidenceUsedKind =
  | "photo_category"
  | "report_finding"
  | "metadata"
  | "coverage";

export type EvidenceUsedItem = {
  kind: EvidenceUsedKind;
  /** Stable machine ref, e.g. canonical photo category or finding key */
  ref: string;
  /** Human-readable label for auditor UI */
  label: string;
  /** Relative weight 0–1 when applicable */
  weight?: number;
};

/** Shared structured output envelope for all intelligence engines. */
export type IntelligenceEngineOutput<TClassification extends Record<string, unknown>> = {
  engineId: IntelligenceEngineId;
  engineVersion: HairAuditIntelligenceEngineVersion;
  /** Primary advisory label for dashboards */
  classification: string;
  /** Engine-specific structured fields */
  fields: TClassification;
  severity: IntelligenceSeverityBand;
  confidence: IntelligenceConfidenceBand;
  evidenceUsed: EvidenceUsedItem[];
  /** Calm, non-diagnostic copy for patient surfaces */
  patientSafeSummary: string;
  /** Forensic / clinical terminology allowed for auditor & doctor modes */
  clinicianNotes: string;
  suggestedNextStep: string;
  limitations: string[];
  /** Always true — outputs are advisory only */
  advisoryOnly: true;
  /** Rule-based placeholder or classifier-enriched rule-based (HA-INTELLIGENCE-3) */
  executionMode: IntelligenceExecutionMode;
  generatedAt: string;
};

export type IntelligenceExecutionMode =
  | "rule_based_placeholder"
  | "classifier_enriched_rule_based";

export type LegacyUploadForIntelligence = {
  id?: string;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ReportSummaryForIntelligence = {
  key_findings?: Array<{ title?: string; severity?: string; domain?: string } | string>;
  red_flags?: Array<{ title?: string; severity?: string } | string>;
  domains?: Record<string, { findings?: Array<{ title?: string; severity?: string }> }>;
};

// ─── Input contract ───────────────────────────────────────────────────────────

export type IntelligenceImageRef = {
  uploadId?: string;
  canonicalPhotoCategory: string;
  qualityStatus?: string | null;
  protocolStatus?: string | null;
  /** Classifier confidence 0–1 when available from FI / ImagingOS */
  classifierConfidence?: number | null;
  /** Per-image limitations from classifier or upload quality/protocol metadata */
  imageLimitations?: string[];
};

export type ClassifierEnrichmentSource =
  | "none"
  | "fi_persisted_jobs"
  | "upload_metadata"
  | "fi_and_upload_metadata";

export type IntelligenceReportFindingRef = {
  domain?: string;
  title: string;
  severity?: "low" | "medium" | "high" | "critical" | null;
  source?: string;
};

export type IntelligenceEngineInput = {
  caseId?: string;
  images: IntelligenceImageRef[];
  reportFindings?: IntelligenceReportFindingRef[];
  metadata?: Record<string, unknown>;
};

// ─── Engine 1: Hair Loss Classification ─────────────────────────────────────

export type NorwoodStageEstimate =
  | "I"
  | "II"
  | "III"
  | "III_vertex"
  | "IV"
  | "V"
  | "VI"
  | "VII"
  | "indeterminate"
  | "not_assessable";

export type CrownProgressionEstimate =
  | "none_observed"
  | "early"
  | "moderate"
  | "advanced"
  | "not_assessable";

export type DiffuseThinningEstimate =
  | "none_suggested"
  | "possible"
  | "likely"
  | "not_assessable";

export type HairLossClassificationFields = {
  norwoodStage: NorwoodStageEstimate;
  crownProgression: CrownProgressionEstimate;
  diffuseThinningPattern: DiffuseThinningEstimate;
  evidenceLimitations: string[];
};

export type HairLossClassificationOutput = IntelligenceEngineOutput<HairLossClassificationFields>;

// ─── Engine 2: Donor Intelligence ───────────────────────────────────────────

export type DonorDensityBand =
  | "appears_adequate"
  | "moderate"
  | "appears_limited"
  | "not_assessable";

export type MiniaturisationSuspicion =
  | "none_suggested"
  | "possible"
  | "elevated_suspicion"
  | "not_assessable";

export type RetrogradeAlopeciaPattern =
  | "none_suggested"
  | "possible"
  | "pattern_suggested"
  | "not_assessable";

export type ExtractionSafetyConcern =
  | "none_noted"
  | "borderline"
  | "elevated"
  | "not_assessable";

export type DonorReserveRisk =
  | "low"
  | "moderate"
  | "elevated"
  | "not_assessable";

export type DonorIntelligenceFields = {
  donorDensityBand: DonorDensityBand;
  miniaturisationSuspicion: MiniaturisationSuspicion;
  retrogradeAlopeciaPattern: RetrogradeAlopeciaPattern;
  extractionSafetyZoneConcerns: ExtractionSafetyConcern;
  donorReserveRisk: DonorReserveRisk;
};

export type DonorIntelligenceOutput = IntelligenceEngineOutput<DonorIntelligenceFields>;

// ─── Engine 3: Repair Surgery ─────────────────────────────────────────────────

export type OverharvestingIndicator =
  | "none_suggested"
  | "possible"
  | "likely"
  | "not_assessable";

export type PriorTransplantEvidence =
  | "none_suggested"
  | "possible"
  | "likely"
  | "not_assessable";

export type DonorDepletionEstimate =
  | "none_suggested"
  | "possible"
  | "likely"
  | "not_assessable";

export type UnnaturalAngulationEstimate =
  | "none_suggested"
  | "possible"
  | "likely"
  | "not_assessable";

export type PoorDensityDistributionEstimate =
  | "none_suggested"
  | "possible"
  | "likely"
  | "not_assessable";

export type RepairComplexityBand =
  | "low"
  | "moderate"
  | "high"
  | "indeterminate";

export type RepairSurgeryFields = {
  overharvestingIndicators: OverharvestingIndicator;
  priorTransplantEvidence: PriorTransplantEvidence;
  donorDepletion: DonorDepletionEstimate;
  unnaturalAngulation: UnnaturalAngulationEstimate;
  poorDensityDistribution: PoorDensityDistributionEstimate;
  repairComplexityBand: RepairComplexityBand;
};

export type RepairSurgeryOutput = IntelligenceEngineOutput<RepairSurgeryFields>;

// ─── Engine 4: Procedural Intelligence ──────────────────────────────────────

export type ImplantationIrregularity =
  | "none_suggested"
  | "minor"
  | "moderate"
  | "significant"
  | "not_assessable";

export type GraftSpacingAnomaly =
  | "none_suggested"
  | "possible"
  | "likely"
  | "not_assessable";

export type AsymmetryEstimate =
  | "none_suggested"
  | "minor"
  | "moderate"
  | "significant"
  | "not_assessable";

export type SurvivalProbabilityBand =
  | "favourable"
  | "moderate"
  | "uncertain"
  | "concerning"
  | "not_assessable";

export type ProceduralConcernSeverity =
  | "none"
  | "minor"
  | "moderate"
  | "significant"
  | "critical";

export type ProceduralIntelligenceFields = {
  implantationPatternIrregularities: ImplantationIrregularity;
  graftSpacingAnomalies: GraftSpacingAnomaly;
  asymmetry: AsymmetryEstimate;
  survivalProbabilityEstimateBand: SurvivalProbabilityBand;
  proceduralConcernSeverity: ProceduralConcernSeverity;
};

export type ProceduralIntelligenceOutput = IntelligenceEngineOutput<ProceduralIntelligenceFields>;

// ─── Bundle ───────────────────────────────────────────────────────────────────

export type HairAuditIntelligenceBundle = {
  engineVersion: HairAuditIntelligenceEngineVersion;
  caseId?: string;
  hairLossClassification: HairLossClassificationOutput;
  donorIntelligence: DonorIntelligenceOutput;
  repairSurgery: RepairSurgeryOutput;
  proceduralIntelligence: ProceduralIntelligenceOutput;
  overallSeverity: IntelligenceSeverityBand;
  overallConfidence: IntelligenceConfidenceBand;
  generatedAt: string;
  /** Classifier-enriched image refs for professional review (shadow metadata only) */
  imageEvidence?: IntelligenceImageRef[];
  classifierSource?: ClassifierEnrichmentSource;
};
