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

/* -------------------------------------------------------------------------- */
/* FI-OUTCOME-INTELLIGENCE-1C — Prospective longitudinal capture              */
/* -------------------------------------------------------------------------- */

export {
  CAPTURE_PLAN_VERSION,
  CAPTURE_PROTOCOL_VERSION,
  CAPTURE_PROTOCOL_VERSIONS,
  type CapturePlanVersion,
  type CaptureProtocolVersion,
  type LongitudinalCaptureMilestoneStatus,
  type LongitudinalCaptureNextActionType,
  type LongitudinalCaptureMilestone,
  type LongitudinalCapturePlan,
  type LongitudinalCapturePlanRecord,
  type CaptureViewInstruction,
  type PatientLongitudinalMilestoneDto,
  type PatientLongitudinalCaptureDto,
  type CaptureProgrammeHealth,
  type CreateCapturePlanInput,
  type CreateCapturePlanResult,
  type ResolveCapturePlanResult,
} from "./longitudinalCaptureTypes";

export {
  CAPTURE_WINDOW_RADIUS_DAYS,
  normalizeProcedureDate,
  addCalendarMonths,
  addCalendarDays,
  todayUtcDate,
  buildMilestoneSchedule,
  relateToCaptureWindow,
  describeCaptureWindowPolicy,
} from "./longitudinalCaptureSchedule";

export {
  CAPTURE_PHOTOGRAPHY_GUIDANCE,
  getCapturePolicy,
  buildMilestoneEvidenceRequirements,
  resolveTreatmentCaptureContext,
  patientSafeLabelForRole,
  patientMilestoneLabel,
  publicViewKeyForRole,
  postopCategoryPrefixForStage,
  isSupportedCapturePlanVersion,
  isSupportedCaptureProtocolVersion,
} from "./longitudinalCapturePolicy";

export {
  assessMilestoneEvidence,
  toPatientViewDtos,
  assertPatientSafeMissingLabels,
} from "./longitudinalCaptureEvidence";

export {
  deriveMilestoneStatus,
  deriveNextAction,
  selectNextPatientMilestone,
} from "./longitudinalCaptureDto";

export {
  InMemoryLongitudinalCapturePlanRepository,
  type LongitudinalCapturePlanRepository,
  type CapturePlanIdempotencyKey,
} from "./longitudinalCaptureRepository";

export {
  LongitudinalCapturePlanService,
  createLongitudinalCapturePlanService,
  assertPatientCaptureDtoSafe,
  type LongitudinalCapturePlanServiceDeps,
  type ResolveCapturePlanInput,
} from "./longitudinalCaptureService";

/* -------------------------------------------------------------------------- */
/* FI-OUTCOME-INTELLIGENCE-1D — Longitudinal reminder / engagement            */
/* -------------------------------------------------------------------------- */

export {
  ENGAGEMENT_POLICY_VERSION,
  type EngagementPolicyVersion,
  type LongitudinalReminderEventType,
  type LongitudinalReminderActionType,
  type LongitudinalReminderSuppressionCode,
  type LongitudinalEngagementEventStatus,
  type LongitudinalReminderMessageKey,
  type CanonicalEngagementMilestoneInput,
  type LongitudinalReminderEvent,
  type LongitudinalEngagementEventRecord,
  type PatientLongitudinalEngagementDto,
  type EngagementDecisionResult,
  type RevalidationResult,
  type EngagementBatchHealth,
  type LongitudinalEngagementAuditEventType,
  type LongitudinalEngagementAuditEvent,
} from "./longitudinalEngagementTypes";

export {
  ENGAGEMENT_POLICY_V1,
  getEngagementPolicy,
  describeEngagementTimingPolicy,
  isContactEventType,
  type LongitudinalEngagementPolicy,
} from "./longitudinalEngagementPolicy";

export {
  resolveLongitudinalEngagementConfig,
  assertEngagementApplyAllowed,
  anyExternalChannelEnabled,
  type LongitudinalEngagementConfig,
  type EngagementApplyGate,
} from "./longitudinalEngagementConfig";

export {
  evaluateEngagementEligibility,
  buildReminderEvent,
  buildStateFingerprint,
  buildDedupeKey,
  revalidateReminderAgainstMilestone,
  mapReminderActionToPatientAction,
  patientActionLabel,
} from "./longitudinalEngagementDecision";

export {
  renderReminderMessage,
  stageLabelForEngagement,
  buildMessageVariables,
  FORBIDDEN_ENGAGEMENT_LANGUAGE,
} from "./longitudinalEngagementTemplates";

export {
  COMMUNICATION_PREFERENCE_GAP,
  resolveChannelAllowance,
  isWithinQuietHours,
  scanMessageForForbiddenLanguage,
  assertReminderCopySafe,
  assertPatientEngagementDtoSafe,
  type CommunicationPreferenceSnapshot,
} from "./longitudinalEngagementSafety";

export {
  InMemoryLongitudinalEngagementEventRepository,
  type LongitudinalEngagementEventRepository,
  type EngagementEventListFilter,
} from "./longitudinalEngagementRepository";

export {
  LongitudinalEngagementService,
  createLongitudinalEngagementService,
  InMemoryEngagementAuditSink,
  milestoneToEngagementInput,
  type LongitudinalEngagementServiceDeps,
  type LongitudinalEngagementAuditSink,
} from "./longitudinalEngagementService";

/* -------------------------------------------------------------------------- */
/* FI-OUTCOME-INTELLIGENCE-1E — Guided longitudinal capture                   */
/* -------------------------------------------------------------------------- */

export {
  resolveGuidedLongitudinalCaptureConfig,
  isGuidedCaptureUiEnabled,
  type GuidedLongitudinalCaptureConfig,
} from "./guidedCaptureConfig";

export type {
  GuidedCaptureViewDto,
  GuidedCaptureProgressDto,
  GuidedLongitudinalCaptureDto,
  GuidedCaptureLandingMilestoneDto,
  GuidedCaptureLandingDto,
  GuidedCaptureWizardStep,
} from "./guidedCaptureDto";

export {
  GUIDED_CAPTURE_STANDARDIZATION,
  GUIDED_CAPTURE_REPRESENTATIVE_COPY,
  GUIDED_CAPTURE_REFERENCE_MATCH_COPY,
  GUIDED_CAPTURE_RECOMMENDED_COPY,
  guidedInstructionsForRole,
  guidedPhotographyGuidance,
} from "./guidedCaptureInstructions";

export {
  FORBIDDEN_GUIDED_CAPTURE_LANGUAGE,
  scanGuidedCaptureCopyForForbiddenLanguage,
  assertGuidedCaptureCopySafe,
  assertPatientGuidedCaptureDtoSafe,
} from "./guidedCaptureSafety";

export {
  orderedGuidedViews,
  firstMissingRequiredView,
  allRequiredComplete,
  resolveGuidedCaptureInitialStep,
  nextViewStep,
  canUploadForMilestoneStatus,
  primaryCtaLabel,
  formatTargetDateForPatient,
} from "./guidedCaptureWizard";

export {
  resolveReferenceImageForRole,
  resolveCurrentImageForCategory,
} from "./guidedCaptureReference";

export {
  isMonthBandedFollowupCategory,
  isSharedLongitudinalRoleCategory,
  isLongitudinalFollowupUploadAllowed,
  uploadCategoryForGuidedRole,
  LONGITUDINAL_CAPTURE_WORKFLOW,
} from "./longitudinalFollowupUploadAllowance";

export {
  buildGuidedLongitudinalCaptureDto,
  buildGuidedCaptureLandingDto,
  buildStatusMessage,
  landingStatusLabel,
  guidedCaptureHref,
  guidedCaptureLandingHref,
  isLongitudinalOutcomeStage,
} from "./guidedCaptureBuilder";
