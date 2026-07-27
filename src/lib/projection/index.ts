/**
 * HA-PROJECTION — Public exports for surgery-day reconstruction (1A), projected outcome (1B),
 * and immutable projection persistence / lineage (1D).
 *
 * Patient projection report presentation lives in `src/lib/reports/surgeryDayProjection*` (1C).
 */

export type {
  HairAuditAssessmentType,
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
