/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Public exports.
 *
 * Clinician-assisted pre-surgery planning workspace domain.
 * Does not replace HA-PROJECTION-1A–1G longitudinal projected-vs-observed infrastructure.
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
  assertProjectionGenerationAllowed,
  findUnsafeProjectionLabel,
  runProjectionValidationPass,
  projectionInvalidatedByPlanChange,
} from "./projection/safety";
export { createStubPreSurgeryProjectionProvider } from "./projection/stubProvider";
export {
  getDefaultPreSurgeryProjectionProvider,
  checkProjectionProviderHealth,
  runInstrumentedProjection,
  DEFAULT_PROJECTION_TIMEOUT_MS,
  type ProjectionProviderHealth,
  type InstrumentedProjectionOutcome,
} from "./projection/health";
export {
  requestPreSurgeryProjection,
  approveIllustrativeProjection,
  rejectIllustrativeProjection,
  type RequestPreSurgeryProjectionInput,
  type RequestPreSurgeryProjectionResult,
} from "./projection/service";
