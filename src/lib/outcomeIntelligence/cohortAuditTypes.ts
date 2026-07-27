/**
 * FI-OUTCOME-INTELLIGENCE-1B — Data quality / coverage audit types.
 *
 * Aggregate-only. No PHI, HMAC keys, raw rows, accuracy %, or provider rankings.
 */

import type { LongitudinalOutcomeStage, ProjectedOutcomeDomain } from "@/lib/projection/types";
import type {
  CohortCalibrationReadiness,
  CohortConfidenceBand,
  EvidenceCompletenessBand,
} from "./cohortTypes";
import type { CohortGovernanceStatus } from "./cohortGovernance";

export type LongitudinalStage = LongitudinalOutcomeStage;
export type ProjectionDomain = ProjectedOutcomeDomain;

export type ConfidenceDistribution = {
  low: number;
  moderate: number;
  high: number;
};

export type AssessabilityDistribution = {
  /** Unique procedures with ≥1 assessable domain status (consistent|partially_consistent|divergent). */
  assessable: number;
  /** Unique procedures whose stage rows are all not_yet_assessable. */
  notYetAssessable: number;
  /** Unique procedures with insufficient_evidence and no assessable domain. */
  insufficientEvidence: number;
};

export type StageCoverage = {
  /** Unique current-lineage procedures with any row at this stage. */
  proceduresWithStage: number;
  /**
   * Denominator: unique current-lineage procedures in the cohort.
   * Null when cohort has zero procedures.
   */
  proportionOfCohort: number | null;
  proceduresWithAssessableDomain: number;
  proceduresOnlyNotYetAssessable: number;
  proceduresWithInsufficientEvidence: number;
  evidenceQuality: ConfidenceDistribution;
  baselineAvailableCount: number;
};

export type SafeDistributionBucket = {
  key: string;
  count: number;
  proportion: number;
};

/**
 * Categorical distribution with small-cell protection.
 * Either fully returned (all visible buckets meet threshold after collapse)
 * or entirely suppressed.
 */
export type SafeDistribution =
  | {
      ok: true;
      /** Unique-procedure denominator for this distribution. */
      total: number;
      buckets: SafeDistributionBucket[];
    }
  | {
      ok: false;
      code: "insufficient_cohort_size";
      minCohortSize: number;
    };

export type CohortCaptureGap = {
  key: string;
  severity: "low" | "moderate" | "high";
  description: string;
  affectedStage?: LongitudinalStage;
  affectedDomain?: ProjectionDomain;
  evidence: {
    /** Only present when count ≥ min cohort size. */
    cohortCount?: number;
    proportion?: number;
  };
  recommendedAction: string;
};

export type CohortDataRecommendation = {
  priority: "high" | "moderate" | "low";
  target: string;
  action: "increase_capture" | "improve_protocol" | "reduce_missingness" | "broaden_representation";
  rationale: string;
};

export type ProspectiveCapturePriority = {
  priority: "high" | "moderate" | "low";
  target: string;
  action: "increase_capture" | "improve_protocol" | "reduce_missingness" | "broaden_representation";
};

export type CohortDataQualityFlag =
  | "LOW_MONTH12_COVERAGE"
  | "LOW_BASELINE_COVERAGE"
  | "HIGH_INSUFFICIENT_EVIDENCE_RATE"
  | "HIGH_LOW_CONFIDENCE_RATE"
  | "ZONE_REPRESENTATION_IMBALANCE"
  | "PROCEDURE_METADATA_MISSINGNESS"
  | "INSUFFICIENT_MATURE_CASES"
  | "SCHEMA_VERSION_HETEROGENEITY"
  | "EMPTY_COHORT"
  | "LINEAGE_INTEGRITY_ISSUE";

export type MaterializationStatus =
  | "not_enabled"
  | "enabled_no_rows"
  | "populated";

export type DomainStageStatusCounts = {
  uniqueProcedures: number;
  assessable: number;
  notYetAssessable: number;
  insufficientEvidence: number;
  consistent: number;
  partiallyConsistent: number;
  divergent: number;
};

export type DomainCoverageEntry = {
  uniqueProcedures: number;
  stages: Record<LongitudinalStage, number>;
  /**
   * Status distributions by stage — suppressed per stage when below threshold.
   */
  statusByStage: Record<
    LongitudinalStage,
    DomainStageStatusCounts | { ok: false; code: "insufficient_cohort_size" }
  >;
};

export type FollowUpRetention = {
  /** Unique procedures with Day-0 projection lineage (any current cohort row). */
  day0ProjectionLineage: number;
  month3Observed: number;
  month6Observed: number;
  month9Observed: number;
  month12Observed: number;
  /**
   * Follow-up data retention (not patient/clinical retention).
   * Null when prior stage has zero procedures.
   */
  month3ToMonth6: number | null;
  month6ToMonth9: number | null;
  month9ToMonth12: number | null;
};

export type MissingDataProfile = {
  unknownProcedureType: number;
  unknownGraftCountBand: number;
  unknownHairsPerGraftBand: number;
  unknownPunchSizeBand: number;
  missingBaseline: number;
  lowEvidence: number;
  missingMonth12FollowUp: number;
  proportions: {
    unknownProcedureType: number | null;
    unknownGraftCountBand: number | null;
    unknownHairsPerGraftBand: number | null;
    unknownPunchSizeBand: number | null;
    missingBaseline: number | null;
    lowEvidence: number | null;
    missingMonth12FollowUp: number | null;
  };
};

export type SchemaVersionHealth = {
  projectionSchemaVersions: SafeDistribution;
  observationSchemaVersions: SafeDistribution;
  comparisonSchemaVersions: SafeDistribution;
  cohortSchemaVersions: SafeDistribution;
  heterogeneityFlagged: boolean;
};

export type LineageHealth = {
  currentRows: number;
  supersededRows: number;
  rowsMissingChecksum: number;
  invalidDomainCount: number;
  invalidStageCount: number;
  missingSchemaVersionCount: number;
  duplicateIdempotencyIdentities: number;
  integrityIssue: boolean;
};

export type OutcomeCohortDataQualityAudit = {
  generatedAt: string;
  cohortSchemaVersion: string;
  tenantScope: "deployment_local";
  governanceStatus: CohortGovernanceStatus;
  /** Technical audit may run; production activation remains separately gated. */
  productionActivation: "BLOCKED_PENDING_POLICY_CONFIRMATION" | "OPERATOR_APPROVED";
  materializationStatus: MaterializationStatus;

  cohort: {
    uniqueProcedures: number;
    uniqueSubjects: number;
    currentDomainRows: number;
    supersededDomainRows: number;
  };

  longitudinalCoverage: {
    month_3: StageCoverage;
    month_6: StageCoverage;
    month_9: StageCoverage;
    month_12: StageCoverage;
  };

  followUpRetention: FollowUpRetention;

  baselineCoverage: {
    withBaseline: number;
    withoutBaseline: number;
    surgeryDayOnly: number;
    unknownAssessmentMode: number;
    proportionWithBaseline: number | null;
  };

  evidenceQuality: ConfidenceDistribution;
  evidenceQualityByStage: Record<LongitudinalStage, ConfidenceDistribution>;
  highEvidenceShareByStage: Record<LongitudinalStage, number | null>;

  projectionConfidence: ConfidenceDistribution;
  observationConfidence: ConfidenceDistribution;
  comparisonConfidence: ConfidenceDistribution;

  assessability: {
    byStage: Record<LongitudinalStage, AssessabilityDistribution>;
  };

  domainCoverage: Record<ProjectionDomain, DomainCoverageEntry>;

  treatmentZoneCoverage: {
    hairline: number | "insufficient_cohort_size";
    temples: number | "insufficient_cohort_size";
    frontal: number | "insufficient_cohort_size";
    forelock: number | "insufficient_cohort_size";
    midScalp: number | "insufficient_cohort_size";
    crown: number | "insufficient_cohort_size";
  };

  procedureContextCoverage: {
    procedureType: SafeDistribution;
    graftCountBand: SafeDistribution;
    hairsPerGraftBand: SafeDistribution;
    punchSizeBand: SafeDistribution;
  };

  missingData: MissingDataProfile;

  schemaVersionHealth: SchemaVersionHealth;
  lineageHealth: LineageHealth;

  calibrationReadiness: {
    status: CohortCalibrationReadiness;
    reasons: string[];
    blockers: string[];
    eligibleForFutureCalibrationProcedures: number;
  };

  dataQualityFlags: CohortDataQualityFlag[];
  captureGaps: CohortCaptureGap[];
  recommendations: CohortDataRecommendation[];
  prospectiveCapturePriorities: ProspectiveCapturePriority[];
};

// Re-export for consumers that import audit types alone
export type { CohortGovernanceStatus, EvidenceCompletenessBand, CohortConfidenceBand };
