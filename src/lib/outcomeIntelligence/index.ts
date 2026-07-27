/**
 * FI-OUTCOME-INTELLIGENCE-1A — Public module surface.
 *
 * Internal analytics foundation only. No patient-facing exports.
 */

export {
  COHORT_SCHEMA_VERSION,
  COHORT_ALLOWLISTED_KEYS,
  COHORT_PROHIBITED_KEYS,
  type CohortSchemaVersion,
  type CohortConfidenceBand,
  type EvidenceCompletenessBand,
  type GraftCountBand,
  type HairsPerGraftBand,
  type PunchSizeBand,
  type ProcedureTypeNormalized,
  type CohortCalibrationReadiness,
  type CohortRowChecksumPayload,
  type OutcomeLongitudinalCohortRow,
  type CohortAggregateSuppressed,
  type DomainComparisonDistribution,
  type CohortCoverageSummary,
  type CohortHealthSummary,
  type MaterializeCohortResult,
} from "./cohortTypes";

export {
  DEFAULT_MIN_COHORT_SIZE,
  resolveOutcomeCohortConfig,
  assertCohortMaterializationAllowed,
  type OutcomeCohortConfig,
  type CohortMaterializationGate,
} from "./cohortConfig";

export {
  evaluateCohortGovernance,
  type CohortGovernanceStatus,
  type CohortGovernanceFinding,
} from "./cohortGovernance";

export {
  COHORT_SUBJECT_NAMESPACE,
  COHORT_PROCEDURE_NAMESPACE,
  COHORT_PARTITION_NAMESPACE,
  COHORT_DEFAULT_PARTITION_LABEL,
  CohortHmacSecretMissingError,
  hmacCohortKey,
  deriveCohortSubjectKey,
  deriveCohortProcedureKey,
  deriveCohortPartitionKey,
} from "./cohortIdentity";

export {
  GRAFT_COUNT_BAND_BOUNDARIES,
  HAIRS_PER_GRAFT_BAND_BOUNDARIES,
  PUNCH_SIZE_BAND_BOUNDARIES,
  bandConfidence,
  bandGraftCount,
  bandHairsPerGraft,
  bandPunchSizeMm,
  normalizeProcedureType,
  normalizeTreatedZoneFlags,
  deriveEvidenceCompletenessBand,
  resolveAssessmentMode,
  extractProcedureMetadataBands,
  isAllowedFollowupStage,
  type TreatedZoneFlags,
  type DomainComparisonFilters,
} from "./cohortNormalization";

export {
  scanForProhibitedCohortKeys,
  assertAllowlistedCohortKeys,
  buildCohortChecksumPayload,
  computeCohortRowChecksum,
  validateCohortRowDeidentified,
  type DeidentificationScanResult,
} from "./cohortDeidentification";

export {
  InMemoryOutcomeCohortAuditSink,
  createCohortAuditEvent,
  type OutcomeCohortAuditEvent,
  type OutcomeCohortAuditEventType,
  type OutcomeCohortAuditSink,
} from "./cohortAudit";

export {
  InMemoryOutcomeCohortRepository,
  type OutcomeCohortRepository,
  type CohortIdempotencyKey,
} from "./cohortRepository";

export {
  OutcomeCohortMaterializationService,
  createOutcomeCohortMaterializationService,
  type OutcomeCohortMaterializationDeps,
  type MaterializeFromComparisonInput,
} from "./cohortMaterialization";

export {
  OutcomeCohortAggregates,
  createOutcomeCohortAggregates,
  type OutcomeCohortAggregateDeps,
} from "./cohortAggregates";

/* -------------------------------------------------------------------------- */
/* FI-OUTCOME-INTELLIGENCE-1B                                                 */
/* -------------------------------------------------------------------------- */

export type {
  OutcomeCohortDataQualityAudit,
  StageCoverage,
  SafeDistribution,
  CohortCaptureGap,
  CohortDataRecommendation,
  ProspectiveCapturePriority,
  CohortDataQualityFlag,
  FollowUpRetention,
  MaterializationStatus,
  DomainCoverageEntry,
  ConfidenceDistribution,
  AssessabilityDistribution,
} from "./cohortAuditTypes";

export {
  AUDIT_STAGES,
  AUDIT_DOMAINS,
  uniqueProcedureKeys,
  buildSafeDistribution,
  buildStageCoverage,
  buildFollowUpRetention,
  assessabilityForStage,
  domainStatusCounts,
  suppressCount,
} from "./cohortCoverage";

export {
  countEligibleForFutureCalibration,
  resolveCalibrationReadiness,
  type CalibrationReadinessResult,
} from "./cohortReadiness";

export { deriveDataQualityFlags } from "./cohortDataQualityFlags";

export {
  buildCaptureGaps,
  buildRecommendations,
  buildProspectiveCapturePriorities,
} from "./cohortAuditRecommendations";

export {
  OutcomeCohortDataQualityAuditService,
  createOutcomeCohortDataQualityAuditService,
  sanitizeAuditForExport,
  formatAuditHumanReadable,
  type OutcomeCohortDataQualityAuditDeps,
} from "./cohortDataQualityAudit";
