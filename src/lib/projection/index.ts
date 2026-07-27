/**
 * HA-PROJECTION-1A — Public exports for surgery-day procedure reconstruction.
 *
 * Derived canonical layer only. No patient projection PDF / outcome claims in 1A.
 */

export type {
  HairAuditAssessmentType,
  SurgeryDayReconstructionAssessmentType,
  SurgeryDayEvidenceRole,
  SurgeryDayReconstructionMode,
  SurgeryDayEvidenceAssessment,
  SurgeryDayProcedureReconstruction,
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
