/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A/2C/2D / OPENAI-IMAGE-PROVIDER-2B — Public exports.
 *
 * Clinician-assisted pre-surgery planning workspace domain.
 * Does not replace HA-PROJECTION-1A–1G longitudinal projected-vs-observed infrastructure.
 * Cosmetic outcomes: openai gpt-image when keyed; ImagingOS optional; local_illustrative
 * overlay maps only. Prefer kill-switch + allowlists for ImagingOS pilots.
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
export * from "./reportProjectionCopy";
export * from "./reportProjectionConsistency";
export * from "./reportProjectionInclusion";
export * from "./projectionCorrections";
export * from "./projectionLearningSignals";
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
  createLocalIllustrativePreSurgeryProjectionProvider,
  LOCAL_ILLUSTRATIVE_PROVIDER_ID,
  LOCAL_ILLUSTRATIVE_MODEL_VERSION,
} from "./projection/localIllustrativeProvider";
export {
  composeLocalIllustrativeProjection,
} from "./projection/localIllustrativeComposer";
export {
  isStubProjectionStoragePath,
  projectionHasApproximatelyValidImagePath,
  assertProjectionAssetApproximatelyForApproval,
  STUB_GENERATION_NO_ASSET_MESSAGE,
} from "./projection/assetValidation";
export {
  resolvePlanForProjectionGeneration,
  buildProjectionPlanPreview,
} from "./projection/planConfirmation";
export {
  createImagingOsPreSurgeryProjectionProvider,
  signImagingOsRequest,
  verifyImagingOsCallbackSignature,
} from "./projection/imagingOsProvider";
export {
  resolveProjectionProviderConfig,
  imagingosConfigReady,
  imagingOsCredentialsPresent,
  openaiCredentialsPresent,
  openaiConfigReady,
  HA_PRE_SURGERY_PROJECTION_PROVIDER_ENV,
  HA_OPENAI_GPT_IMAGE_MODEL_ENV,
  OPENAI_API_KEY_ENV,
  HA_IMAGINGOS_PROJECTION_URL_ENV,
  HA_IMAGINGOS_PROJECTION_TOKEN_ENV,
} from "./projection/config";
export {
  resolveProjectionArtifactType,
  isPatientReportOutcomeArtifact,
  isOverlayRendererArtifact,
  ARTIFACT_TYPE_LABELS,
  PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
  ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER,
  type PreSurgeryArtifactType,
} from "./projection/artifactTypes";
export {
  OPENAI_GPT_IMAGE_PROVIDER_ID,
  OPENAI_GPT_IMAGE_MODEL_DEFAULT,
  createOpenAiGptImageProjectionProvider,
  pickOpenAiEditSize,
} from "./projection/openaiGptImageProvider";
export { assertApprovedHairlineDesignForOutcome } from "./projection/hairlineApprovalGate";
export { validateProjectedOutcomeAsset } from "./projection/outcomeValidation";
export { buildRecipientEditMask } from "./projection/treatmentMask";
export {
  buildOpenAiProjectedOutcomeEditPrompt,
  OPENAI_EDIT_PROMPT_VERSION,
} from "./projection/openaiEditPrompt";
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
  resolveOverlayRendererProvider,
  resolveCosmeticOutcomeProvider,
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
