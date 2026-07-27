/**
 * HA-PROJECTION — Public exports for surgery-day reconstruction (1A), projected outcome (1B),
 * immutable projection persistence / lineage (1D), longitudinal observed outcomes (1E),
 * and projected vs observed comparison (1F).
 *
 * Patient projection report presentation lives in `src/lib/reports/surgeryDayProjection*` (1C)
 * and longitudinal review in `src/lib/reports/longitudinalProjectionReview*` (1G).
 */

export type {
  HairAuditAssessmentType,
  LongitudinalProjectionReviewAssessmentType,
  SurgeryDayReconstructionAssessmentType,
  SurgeryDayProjectionAssessmentType,
  SurgeryDayEvidenceRole,
  SurgeryDayReconstructionMode,
  SurgeryDayEvidenceAssessment,
  SurgeryDayProcedureReconstruction,
  SurgeryDayProjectedOutcome,
  PatientSafeProjectedCharacteristic,
  ProjectedOutcomeDomain,
  ProjectionConfidence,
  ObservedFeature,
  ObservedFeatureSource,
  RecipientZone,
  ProvenancedNumber,
  ProvenancedNumberSource,
  GraftEvidenceSource,
  ReconstructionConfidence,
  ProjectionUploadInput,
  ProjectionEvidenceContext,
  LongitudinalOutcomeStage,
  LongitudinalEvidenceRole,
  LongitudinalObservedFeature,
  LongitudinalObservedFeatureSource,
  LongitudinalOutcomeObservation,
  LongitudinalEvidenceContext,
  ObservationConfidence,
  ProjectionComparisonStatus,
  ComparisonConfidence,
  ProjectionDomainComparison,
  ProjectionObservedComparison,
} from "./types";


export {
  resolveProjectionEvidenceRole,
  resolveBaselineEligibility,
  assessSurgeryDayEvidence,
  listAcceptedCategoryAliases,
  SURGERY_DAY_EVIDENCE_POLICY,
  type ResolvedProjectionEvidence,
  type AssessSurgeryDayEvidenceInput,
} from "./surgeryDayEvidence";

export {
  resolveSurgeryDayProcedureContext,
  type ProcedureContextSources,
  type ResolvedProcedureContext,
} from "./surgeryDayProcedureContext";

export {
  buildSurgeryDayProcedureReconstruction,
  resolveAllProjectionEvidence,
  type BuildSurgeryDayProcedureReconstructionInput,
  type BuildSurgeryDayProcedureReconstructionResult,
  type GraftIntegrityLike,
} from "./surgeryDayProcedureReconstruction";

export {
  buildSurgeryDayProjectedOutcome,
  type BuildSurgeryDayProjectedOutcomeOptions,
  type BuildSurgeryDayProjectedOutcomeResult,
} from "./surgeryDayProjectedOutcome";

export {
  normalizeRecipientZone,
  normalizeZoneList,
  uniqueNormalizedZones,
  describeTreatmentExtent,
} from "./surgeryDayZones";

export {
  findFutureResultClaims,
  sanitizeObservedText,
  assertNoFutureResultClaims,
  SAFE_LIMITATION_TEMPLATES,
} from "./surgeryDayReconstructionSafety";

export {
  findUnsafeProjectionClaims,
  assertPatientSafeProjectionText,
  validateProjectedCharacteristic,
  STANDARD_PROJECTION_ASSUMPTIONS,
  STANDARD_WHAT_CANNOT_YET_BE_DETERMINED,
} from "./surgeryDayProjectionSafety";

export {
  deriveProjectionConfidence,
  extractProjectionConfidenceFactors,
  characteristicConfidence,
  type ProjectionConfidenceFactors,
} from "./surgeryDayProjectionConfidence";

export {
  RECONSTRUCTION_CONTRACT_VERSION,
  PROJECTION_ENGINE_VERSION,
  PROJECTION_SNAPSHOT_SCHEMA_VERSION,
  OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_LINEAGE_VERSION,
  COMPARISON_SCHEMA_VERSION,
} from "./versions";

export {
  canonicalizeForChecksum,
  stableStringifyForChecksum,
  checksumCanonical,
  computeProjectionChecksums,
  VOLATILE_CHECKSUM_KEYS,
} from "./canonicalChecksum";

export type {
  ProjectionSnapshot,
  ProjectionSnapshotStatus,
  ProjectionSupersessionReasonCode,
  CreateProjectionSnapshotInput,
  CreateProjectionSnapshotResult,
  LongitudinalObservationReference,
  LongitudinalObservationTimepoint,
  ProjectionConfidenceSummary,
  ProjectionEvidenceSummary,
} from "./projectionSnapshotTypes";

export { PROJECTION_SUPERSESSION_REASON_CODES } from "./projectionSnapshotTypes";

export {
  verifyProjectionSnapshotIntegrity,
  type ProjectionSnapshotIntegrityResult,
} from "./projectionSnapshotIntegrity";

export {
  InMemoryProjectionSnapshotRepository,
  type ProjectionSnapshotRepository,
} from "./projectionSnapshotRepository";

export {
  ProjectionSnapshotService,
  createProjectionSnapshotService,
  type ProjectionSnapshotServiceDeps,
  type CaseOwnershipRow,
} from "./projectionSnapshotService";

export {
  InMemoryProjectionSnapshotAuditSink,
  buildSnapshotAuditMetadata,
  createAuditEvent,
  type ProjectionSnapshotAuditEvent,
  type ProjectionSnapshotAuditEventType,
  type ProjectionSnapshotAuditSink,
} from "./projectionSnapshotAudit";

export {
  attachLongitudinalObservationReference,
  assertNoRetrospectiveContamination,
  LONGITUDINAL_OBSERVATION_TIMEPOINTS,
} from "./longitudinalObservationContract";

export {
  validateReconstructionForSnapshot,
  validateProjectedOutcomeForSnapshot,
  validateCaseOwnership,
  isSurgeryDayReconstruction,
  isSurgeryDayProjectedOutcome,
} from "./projectionSnapshotValidate";

/* -------------------------------------------------------------------------- */
/* HA-PROJECTION-1E                                                           */
/* -------------------------------------------------------------------------- */

export {
  resolveLongitudinalEvidenceRole,
  resolveLongitudinalOutcomeStage,
  assessLongitudinalEvidence,
  isCrownRelevant,
  listLongitudinalCategoryAliases,
  listLongitudinalCategoryStages,
  LONGITUDINAL_OUTCOME_STAGES,
  LONGITUDINAL_MINIMUM_ROLE,
  LONGITUDINAL_RECOMMENDED_ROLES,
  type ResolvedLongitudinalEvidence,
  type ResolvedLongitudinalStage,
  type LongitudinalEvidenceAssessment,
} from "./longitudinalEvidence";

export {
  findUnsafeLongitudinalObservationClaims,
  sanitizeLongitudinalObservationText,
  assertPatientSafeLongitudinalObservation,
  STAGE_AWARE_OBSERVATION_TEMPLATES,
  type LongitudinalSafetyViolation,
} from "./longitudinalObservationSafety";

export {
  extractLongitudinalObservationConfidenceFactors,
  deriveObservationConfidence,
  type LongitudinalObservationConfidenceFactors,
} from "./longitudinalObservationConfidence";

export {
  buildLongitudinalOutcomeObservation,
  collectStageEvidence,
  type BuildLongitudinalOutcomeObservationInput,
  type BuildLongitudinalOutcomeObservationResult,
} from "./longitudinalOutcomeObservation";

export type {
  ProjectionObservationSnapshot,
  ProjectionObservationStatus,
  ProjectionObservationSupersessionReasonCode,
  CreateProjectionObservationInput,
  CreateProjectionObservationResult,
} from "./projectionObservationTypes";

export { PROJECTION_OBSERVATION_SUPERSESSION_REASON_CODES } from "./projectionObservationTypes";

export {
  InMemoryProjectionObservationRepository,
  type ProjectionObservationRepository,
} from "./projectionObservationRepository";

export {
  InMemoryProjectionObservationAuditSink,
  buildObservationAuditMetadata,
  createObservationAuditEvent,
  type ProjectionObservationAuditEvent,
  type ProjectionObservationAuditEventType,
  type ProjectionObservationAuditSink,
} from "./projectionObservationAudit";

export {
  ProjectionObservationService,
  createProjectionObservationService,
  computeObservationChecksum,
  observationChecksumDomain,
  type ProjectionObservationServiceDeps,
} from "./projectionObservationService";

/* -------------------------------------------------------------------------- */
/* HA-PROJECTION-1F                                                           */
/* -------------------------------------------------------------------------- */

export {
  STAGE_DOMAIN_ASSESSABILITY,
  getDomainAssessability,
  collectObservationForDomain,
  hasAdequateEvidenceForDomain,
  compareProjectedDomain,
  deriveOverallComparisonStatus,
  buildComparisonSummary,
  listComparableProjectedDomains,
  extractFrontalSignal,
  extractDensitySignal,
  extractTransitionSignal,
  extractNativeSignal,
  extractUntreatedSignal,
  type DomainAssessability,
  type DomainObservationBundle,
} from "./projectionComparisonRules";

export {
  deriveComparisonConfidence,
  extractComparisonConfidenceFactors,
  type ComparisonConfidenceFactors,
  type ComparisonDomainAssessability,
} from "./projectionComparisonConfidence";

export {
  findUnsafeComparisonClaims,
  assertPatientSafeComparisonText,
  sanitizeComparisonText,
  isAllowedComparisonVocabulary,
  type ComparisonSafetyViolation,
} from "./projectionComparisonSafety";

export {
  buildProjectionObservedComparison,
  computeComparisonChecksum,
  comparisonChecksumDomain,
  resolveProjectionContentChecksum,
  type BuildProjectionObservedComparisonResult,
} from "./projectionComparison";

export type {
  ProjectionComparisonSnapshot,
  ProjectionComparisonStatusRow,
  ProjectionComparisonSupersessionReasonCode,
  CreateProjectionComparisonInput,
  CreateProjectionComparisonResult,
} from "./projectionComparisonTypes";

export { PROJECTION_COMPARISON_SUPERSESSION_REASON_CODES } from "./projectionComparisonTypes";

export {
  InMemoryProjectionComparisonRepository,
  type ProjectionComparisonRepository,
} from "./projectionComparisonRepository";

export {
  InMemoryProjectionComparisonAuditSink,
  buildComparisonAuditMetadata,
  createComparisonAuditEvent,
  type ProjectionComparisonAuditEvent,
  type ProjectionComparisonAuditEventType,
  type ProjectionComparisonAuditSink,
} from "./projectionComparisonAudit";

export {
  ProjectionComparisonService,
  createProjectionComparisonService,
  type ProjectionComparisonServiceDeps,
} from "./projectionComparisonService";
