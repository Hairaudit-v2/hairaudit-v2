/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A/2C/2D — Public exports.
 *
 * Clinician-assisted pre-surgery planning workspace domain.
 * Does not replace HA-PROJECTION-1A–1G longitudinal projected-vs-observed infrastructure.
 * 2D: controlled ImagingOS activation — keep HA_PRE_SURGERY_PROJECTION_PROVIDER=stub in production
 * until a deliberate allowlisted pilot.
 */

export * from "./versions";
export * from "./imageRoles";
export * from "./types";
export * from "./imageReview";
export * from "./annotations";
export * from "./observations";
export * from "./graftPlanTotals";
export * from "./graftPlanValidate";
export * from "./graftPlanCompare";
export * from "./graftPlanSeed";
export * from "./graftPlanConcurrency";
export * from "./reportIntegration";
export * from "./accessPolicy";
export * from "./auditTimeline";
export * from "./workspaceStore";

export type {
  PreSurgeryProjectionProvider,
  PreSurgeryProjectionInput,
  PreSurgeryProjectionResult,
} from "./projection/provider";
export {
  deriveProjectionModeAllocation,
  STANDARD_PRE_SURGERY_PROJECTION_ASSUMPTIONS,
} from "./projection/modes";
export {
  PROJECTION_MODE_CONTRACTS,
  validateProjectionModeContract,
  patientSafeDisclaimerForMode,
} from "./projection/modeContracts";
export {
  buildCanonicalProjectionRequest,
  checksumCanonicalProjectionRequest,
} from "./projection/canonicalRequest";
export {
  assertProjectionStatusTransition,
  canTransitionProjectionStatus,
  isPatientVisibleProjectionStatus,
} from "./projection/stateMachine";
export {
  evaluatePatientProjectionVisibility,
  PATIENT_PROJECTION_FRAMING,
  findUnsafePatientClaimLanguage,
} from "./projection/patientVisibility";
export {
  assertProjectionGenerationAllowed,
  findUnsafeProjectionLabel,
  runProjectionValidationPass,
  projectionInvalidatedByPlanChange,
} from "./projection/safety";
export { createStubPreSurgeryProjectionProvider } from "./projection/stubProvider";
export {
  createImagingOsPreSurgeryProjectionProvider,
  signImagingOsRequest,
  verifyImagingOsCallbackSignature,
} from "./projection/imagingOsProvider";
export {
  resolveProjectionProviderConfig,
  imagingosConfigReady,
  HA_PRE_SURGERY_PROJECTION_PROVIDER_ENV,
  HA_IMAGINGOS_PROJECTION_URL_ENV,
  HA_IMAGINGOS_PROJECTION_TOKEN_ENV,
} from "./projection/config";
export {
  resolveProjectionActivationControls,
  decideProjectionActivation,
  decidePatientSharingAllowed,
  decideReportProjectionInclusionAllowed,
  HA_PRE_SURGERY_IMAGINGOS_ENABLED_ENV,
  HA_PRE_SURGERY_PROVIDER_KILL_SWITCH_ENV,
  HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH_ENV,
  HA_PRE_SURGERY_PROJECTION_SHADOW_MODE_ENV,
  type ProjectionActivationControls,
  type ProjectionReleaseStage,
  type ActivationDecision,
} from "./projection/activationControls";
export {
  runProjectionPreflight,
  type PreflightInput,
  type PreflightOutcome,
} from "./projection/preflight";
export {
  resolveShadowModePolicy,
  applyShadowModeToProjection,
  assertSeniorClinicianForShadowApproval,
  validateShadowQualityReview,
  SHADOW_QUALITY_REVIEW_DIMENSIONS,
  QUALITY_REVIEW_COHORT_CATEGORIES,
} from "./projection/shadowMode";
export {
  validateProviderProjectionOutput,
  applyOutputValidationToProjection,
  SUPPORTED_PROJECTION_OUTPUT_MIME_TYPES,
} from "./projection/outputValidation";
export {
  evaluateProjectionStaleness,
  markProjectionStale,
  isProjectionStaleForSharing,
  type ProjectionStaleReason,
} from "./projection/staleness";
export {
  buildPatientProjectionConsentRecord,
  buildPatientProjectionPresentation,
  PATIENT_PROJECTION_CONSENT_STATEMENTS,
} from "./projection/patientConsent";
export {
  buildProjectionOpsDashboard,
  collectStaleApprovedCaseIds,
} from "./projection/opsDashboard";
export {
  verifyRollbackTo2BBoundary,
  revokeAllPatientSharing,
  ROLLBACK_2B_CHECKLIST,
} from "./projection/rollback";
export {
  assertCallbackNotReplayed,
  assertCallbackTargetsCase,
  createMemoryCallbackReplayStore,
} from "./projection/callbackSecurity";
export { summariseProjectionMetrics } from "./projection/metrics";
export {
  getDefaultPreSurgeryProjectionProvider,
  resolveRuntimeProjectionProvider,
  checkProjectionProviderHealth,
  runInstrumentedProjection,
  DEFAULT_PROJECTION_TIMEOUT_MS,
  type ProjectionProviderHealth,
  type InstrumentedProjectionOutcome,
} from "./projection/health";
export {
  requestPreSurgeryProjection,
  approveIllustrativeProjection,
  approveIllustrativeProjectionWithChecklist,
  rejectIllustrativeProjection,
  supersedeApprovedProjection,
  emptyApprovalChecklist,
  buildRegenerationSeed,
  APPROVAL_CHECKLIST_KEYS,
  REJECTION_REASONS,
  type RequestPreSurgeryProjectionInput,
  type RequestPreSurgeryProjectionResult,
} from "./projection/service";
