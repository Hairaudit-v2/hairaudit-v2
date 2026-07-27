/**
 * HA-PROJECTION — Public exports for surgery-day reconstruction (1A) and projected outcome (1B).
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
