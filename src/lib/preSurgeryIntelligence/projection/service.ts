/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C/2D — Projection request orchestration + lifecycle.
 * Provider-neutral; ImagingOS adapter is selected via config. Distinct from HA-PROJECTION-1A–1G.
 * 2D adds activation controls, preflight, shadow mode, and provider-output validation.
 */

import { createHash } from "node:crypto";
import {
  PRE_SURGERY_PROJECTION_ENGINE_VERSION,
  PRE_SURGERY_PROJECTION_GENERATION_POLICY_VERSION,
  PRE_SURGERY_PROJECTION_SAFETY_LABEL_VERSION,
} from "../versions";
import {
  PRE_SURGERY_PROJECTION_PATIENT_LABELS,
  type ClinicalImageAnnotation,
  type ClinicalImageReview,
  type ClinicalObservation,
  type PreSurgeryGraftPlan,
  type PreSurgeryIllustrativeProjection,
  type PreSurgeryProjectionMode,
} from "../types";
import { deriveProjectionModeAllocation } from "./modes";
import type { PreSurgeryProjectionProvider } from "./provider";
import {
  assertProjectionGenerationAllowed,
  findUnsafeProjectionLabel,
  runProjectionValidationPass,
} from "./safety";
import {
  resolveRuntimeProjectionProvider,
  runInstrumentedProjection,
  type ProjectionProviderHealth,
} from "./health";
import {
  buildCanonicalProjectionRequest,
  checksumCanonicalProjectionRequest,
} from "./canonicalRequest";
import {
  patientSafeDisclaimerForMode,
  validateProjectionModeContract,
} from "./modeContracts";
import {
  decideProjectionActivation,
  resolveProjectionActivationControls,
  type ProjectionActivationControls,
} from "./activationControls";
import { applyShadowModeToProjection, resolveShadowModePolicy } from "./shadowMode";
import {
  applyOutputValidationToProjection,
  validateProviderProjectionOutput,
  type ProjectionOutputValidationInput,
} from "./outputValidation";
import {
  isStubProjectionStoragePath,
  STUB_GENERATION_NO_ASSET_MESSAGE,
} from "./assetValidation";

export type RequestPreSurgeryProjectionActivationContext = {
  controls?: ProjectionActivationControls;
  providerKind?: "stub" | "imagingos" | "local_illustrative" | "disabled";
  clinicId?: string | null;
  requestsForCase?: number;
  requestsToday?: number;
  /** Defaults to true when omitted (2A–2C stub compatibility). */
  caseLevelEnabled?: boolean;
  /** When true, enforce activation even for stub. */
  enforceActivation?: boolean;
};

export type RequestPreSurgeryProjectionInput = {
  caseId: string;
  plan: PreSurgeryGraftPlan;
  sourceReview: ClinicalImageReview;
  /** Additional reviews for multi-view mode contracts (roles only). */
  sourceReviews?: ClinicalImageReview[];
  sourceImageRef: string;
  sourceImageRefs?: Array<{ imageId: string; storageRef: string }>;
  approvedAnnotations: ClinicalImageAnnotation[];
  approvedObservations?: ClinicalObservation[];
  mode: PreSurgeryProjectionMode;
  requiredImagesPresent: boolean;
  proposedHairlineConfirmed: boolean;
  treatmentAreaConfirmed: boolean;
  requestedBy: string;
  deterministicSeed?: string | null;
  provider?: PreSurgeryProjectionProvider;
  providerId?: string;
  modelVersion?: string;
  timeoutMs?: number;
  now?: string;
  id?: string;
  regeneratesFromProjectionId?: string | null;
  projectionVersion?: number;
  idempotencyKey?: string | null;
  /** 2D activation / allowlist context. */
  activation?: RequestPreSurgeryProjectionActivationContext;
  /** Optional provider-output metadata for 2D validation (ImagingOS / local illustrative). */
  outputValidation?: Partial<ProjectionOutputValidationInput> | null;
  /** Optional provider health snapshot (skips live health when provided). */
  providerHealth?: ProjectionProviderHealth | null;
  /**
   * REAL-ASSET-1A — When true (API route default), reject .stub / missing-asset outputs
   * instead of advancing to clinician_review. Unit tests that inject stub may leave false.
   */
  requireValidImageAsset?: boolean;
};

export type RequestPreSurgeryProjectionResult =
  | {
      ok: true;
      projection: PreSurgeryIllustrativeProjection;
      providerId: string;
      latencyMs: number;
      auditHints: Array<{ eventType: string; metadata: Record<string, unknown> }>;
    }
  | {
      ok: false;
      errors: Array<{ code: string; message: string }>;
      providerId?: string;
      latencyMs?: number;
      degradable?: boolean;
      projection?: PreSurgeryIllustrativeProjection;
      auditHints?: Array<{ eventType: string; metadata: Record<string, unknown> }>;
    };

export async function requestPreSurgeryProjection(
  input: RequestPreSurgeryProjectionInput
): Promise<RequestPreSurgeryProjectionResult> {
  const now = input.now ?? new Date().toISOString();
  const auditHints: Array<{ eventType: string; metadata: Record<string, unknown> }> = [];
  const runtime = resolveRuntimeProjectionProvider();
  const provider = input.provider ?? runtime.provider;
  const providerId = input.providerId ?? runtime.providerId;
  const modelVersion = input.modelVersion ?? runtime.modelVersion;
  const controls =
    input.activation?.controls ?? resolveProjectionActivationControls();
  const providerKind =
    input.activation?.providerKind ??
    (runtime.disabled
      ? "disabled"
      : runtime.providerId.startsWith("imagingos")
        ? "imagingos"
        : runtime.providerId.startsWith("local-illustrative")
          ? "local_illustrative"
          : "stub");
  const enforceActivation =
    input.activation?.enforceActivation === true ||
    providerKind === "imagingos" ||
    providerKind === "local_illustrative";
  const requireValidImageAsset = input.requireValidImageAsset === true;

  if (controls.providerKillSwitch) {
    auditHints.push({
      eventType: "projection_activation_denied",
      metadata: { code: "provider_kill_switch", contactedProvider: false },
    });
    return {
      ok: false,
      errors: [{ code: "provider_kill_switch", message: "Projection provider kill switch is active" }],
      providerId,
      degradable: true,
      auditHints,
    };
  }

  if (runtime.disabled && !input.provider) {
    return {
      ok: false,
      errors: [{ code: "provider_disabled", message: "Projection provider is disabled or misconfigured" }],
      providerId,
      degradable: true,
      auditHints: [
        {
          eventType: "projection_provider_failure",
          metadata: { providerId, code: "provider_disabled" },
        },
      ],
    };
  }

  if (enforceActivation) {
    const activation = decideProjectionActivation({
      controls,
      providerKind,
      clinicId: input.activation?.clinicId ?? null,
      clinicianId: input.requestedBy,
      caseId: input.caseId,
      mode: input.mode,
      requestsForCase: input.activation?.requestsForCase ?? 0,
      requestsToday: input.activation?.requestsToday ?? 0,
      caseLevelEnabled: input.activation?.caseLevelEnabled !== false,
    });
    if (!activation.allowed) {
      auditHints.push({
        eventType: "projection_preflight_rejected",
        metadata: {
          codes: [activation.code],
          message: activation.message,
          contactedProvider: false,
        },
      });
      auditHints.push({
        eventType: "projection_activation_denied",
        metadata: { code: activation.code, contactedProvider: false },
      });
      return {
        ok: false,
        errors: [{ code: activation.code, message: activation.message }],
        providerId,
        degradable: true,
        auditHints,
      };
    }
  }

  const sourceReviews = input.sourceReviews?.length
    ? input.sourceReviews
    : [input.sourceReview];

  const modeIssues = validateProjectionModeContract({
    mode: input.mode,
    plan: input.plan,
    availableRoles: sourceReviews.map((r) => r.assignedRole),
  });
  if (modeIssues.length > 0) {
    auditHints.push({
      eventType: "projection_validation_rejected",
      metadata: { mode: input.mode, codes: modeIssues.map((i) => i.code) },
    });
    const failed: PreSurgeryIllustrativeProjection = buildFailedProjection(input, {
      status: "validation_failed",
      now,
      providerId,
      modelVersion,
      failureCode: modeIssues[0]!.code,
      failureMessage: modeIssues[0]!.message,
      inputChecksum: "validation_failed",
    });
    return {
      ok: false,
      errors: modeIssues.map((i) => ({ code: i.code, message: i.message })),
      providerId,
      degradable: true,
      projection: failed,
      auditHints,
    };
  }

  const gates = assertProjectionGenerationAllowed({
    plan: input.plan,
    sourceImageRole: input.sourceReview.assignedRole,
    sourceImageReviewStatus: input.sourceReview.reviewStatus,
    sourceImageQualityFlags: input.sourceReview.qualityFlags,
    requiredImagesPresent: input.requiredImagesPresent,
    proposedHairlineConfirmed: input.proposedHairlineConfirmed,
    treatmentAreaConfirmed: input.treatmentAreaConfirmed,
    clinicianExplicitlyRequested: true,
    approvedAnnotations: input.approvedAnnotations,
  });
  if (gates.length > 0) {
    auditHints.push({
      eventType: "projection_validation_rejected",
      metadata: { codes: gates.map((g) => g.code) },
    });
    return {
      ok: false,
      errors: gates.map((g) => ({ code: g.code, message: g.message })),
      auditHints,
    };
  }

  const label = PRE_SURGERY_PROJECTION_PATIENT_LABELS[input.mode];
  const labelViolation = findUnsafeProjectionLabel(label);
  if (labelViolation) {
    return { ok: false, errors: [{ code: labelViolation.code, message: labelViolation.message }] };
  }

  const approvedAnnotations = input.approvedAnnotations.filter((a) => a.approved && !a.deletedAt);
  const approvedObservations = (input.approvedObservations ?? []).filter(
    (o) => o.status === "confirmed" || o.status === "corrected"
  );

  const canonical = buildCanonicalProjectionRequest({
    caseId: input.caseId,
    plan: input.plan,
    mode: input.mode,
    sourceReviews,
    primarySourceImageId: input.sourceReview.imageId,
    sourceImageRefs: input.sourceImageRefs ?? [
      { imageId: input.sourceReview.imageId, storageRef: input.sourceImageRef },
    ],
    approvedAnnotations,
    approvedObservations,
    providerId,
    modelVersion,
  });
  const inputChecksum = checksumCanonicalProjectionRequest(canonical);
  // Base attempts share case+checksum+mode. Regeneration must not collide with the prior row.
  const idempotencyBasis = input.regeneratesFromProjectionId
    ? `${input.caseId}:${inputChecksum}:${input.mode}:regen:${input.regeneratesFromProjectionId}:${input.projectionVersion ?? 1}`
    : `${input.caseId}:${inputChecksum}:${input.mode}`;
  const idempotencyKey =
    input.idempotencyKey ??
    createHash("sha256").update(idempotencyBasis).digest("hex").slice(0, 40);

  const allocation = deriveProjectionModeAllocation(input.plan, input.mode);

  auditHints.push({
    eventType: "projection_provider_request_sent",
    metadata: {
      providerId,
      mode: input.mode,
      inputChecksum,
      idempotencyKey,
      modelVersion,
    },
  });

  const instrumented = await runInstrumentedProjection(
    provider,
    providerId,
    {
      caseId: input.caseId,
      sourceImageId: input.sourceReview.imageId,
      sourceImageRef: input.sourceImageRef,
      approvedGraftPlanId: input.plan.id,
      approvedGraftPlan: input.plan,
      approvedAnnotations,
      mode: input.mode,
      generationVersion: PRE_SURGERY_PROJECTION_ENGINE_VERSION,
      engineVersion: PRE_SURGERY_PROJECTION_ENGINE_VERSION,
      deterministicSeed: input.deterministicSeed ?? null,
      patientSafeProjectionConstraints: [
        "Do not change facial identity, reshape the face, or alter skin tone.",
        "Do not create hair outside approved recipient zones.",
        "Do not fill deferred zones (including deferred crown).",
        "Do not imply guaranteed growth or exact density.",
      ],
      canonicalRequest: canonical,
      inputChecksum,
      idempotencyKey,
    },
    { timeoutMs: input.timeoutMs }
  );

  if (!instrumented.ok) {
    const eventType =
      instrumented.errorCode === "provider_timeout"
        ? "projection_timeout"
        : "projection_provider_failure";
    auditHints.push({
      eventType,
      metadata: {
        providerId: instrumented.providerId,
        errorCode: instrumented.errorCode,
        latencyMs: instrumented.latencyMs,
      },
    });
    const failed = buildFailedProjection(input, {
      status: "failed",
      now,
      providerId: instrumented.providerId,
      modelVersion,
      failureCode: instrumented.errorCode,
      failureMessage: instrumented.message,
      inputChecksum,
      inputSnapshot: canonical as unknown as Record<string, unknown>,
      idempotencyKey,
    });
    return {
      ok: false,
      errors: [{ code: instrumented.errorCode, message: instrumented.message }],
      providerId: instrumented.providerId,
      latencyMs: instrumented.latencyMs,
      degradable: true,
      projection: failed,
      auditHints,
    };
  }

  auditHints.push({
    eventType: "projection_provider_accepted",
    metadata: {
      providerId: instrumented.providerId,
      latencyMs: instrumented.latencyMs,
      providerRequestId: instrumented.result.providerRequestId ?? null,
      providerResponseId: instrumented.result.providerResponseId ?? null,
    },
  });

  const result = instrumented.result;

  if (requireValidImageAsset && isStubProjectionStoragePath(result.outputStorageRef)) {
    auditHints.push({
      eventType: "projection_output_validation_failed",
      metadata: {
        checks: ["stub_placeholder"],
        failureCode: "stub_placeholder",
        contactedProvider: true,
      },
    });
    const failed = buildFailedProjection(input, {
      status: "failed",
      now,
      providerId: instrumented.providerId,
      modelVersion,
      failureCode: "stub_placeholder",
      failureMessage: STUB_GENERATION_NO_ASSET_MESSAGE,
      inputChecksum,
      inputSnapshot: canonical as unknown as Record<string, unknown>,
      idempotencyKey,
    });
    return {
      ok: false,
      errors: [{ code: "stub_placeholder", message: STUB_GENERATION_NO_ASSET_MESSAGE }],
      providerId: instrumented.providerId,
      latencyMs: instrumented.latencyMs,
      degradable: true,
      projection: failed,
      auditHints,
    };
  }

  const hairlineAnnotationPresent = approvedAnnotations.some(
    (a) =>
      (a.annotationType === "proposed_hairline" || a.annotationType === "existing_hairline") &&
      a.approved &&
      !a.deletedAt
  );

  const { validationPass } = runProjectionValidationPass({
    plan: input.plan,
    modeAllocationZones: allocation.zoneGraftTargets,
    sourceImageReviewStatus: input.sourceReview.reviewStatus,
    hairlineAnnotationPresent,
    modeContractIssues: [],
  });

  const failedChecks = validationPass.filter((v) => !v.passed);
  if (failedChecks.length > 0) {
    auditHints.push({
      eventType: "projection_output_safety_failure",
      metadata: { checks: failedChecks.map((f) => f.check) },
    });
  }

  const shadowPolicy = resolveShadowModePolicy(controls);
  const status = failedChecks.length > 0 ? "validation_failed" : "clinician_review";
  let projection: PreSurgeryIllustrativeProjection = {
    id: input.id ?? crypto.randomUUID(),
    caseId: input.caseId,
    graftPlanId: input.plan.id,
    graftPlanVersion: input.plan.version,
    sourceImageId: input.sourceReview.imageId,
    sourceImageIds: canonical.sourceImageIds,
    mode: input.mode,
    patientSafeLabel: label,
    patientSafeDisclaimer: patientSafeDisclaimerForMode(input.mode),
    status,
    engineVersion: PRE_SURGERY_PROJECTION_ENGINE_VERSION,
    generationVersion: PRE_SURGERY_PROJECTION_ENGINE_VERSION,
    safetyLabelVersion: PRE_SURGERY_PROJECTION_SAFETY_LABEL_VERSION,
    generationPolicyVersion: PRE_SURGERY_PROJECTION_GENERATION_POLICY_VERSION,
    deterministicSeed: input.deterministicSeed ?? null,
    storagePath: result.outputStorageRef,
    validationPass,
    limitations: result.limitations,
    planningAssumptions: result.planningAssumptions,
    requestedBy: input.requestedBy,
    requestedAt: now,
    generatedAt: now,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    inputChecksum,
    inputSnapshot: canonical as unknown as Record<string, unknown>,
    outputChecksum: result.outputChecksum,
    providerId: instrumented.providerId,
    providerModelVersion: result.modelVersion ?? modelVersion,
    providerRequestId: result.providerRequestId ?? null,
    providerResponseId: result.providerResponseId ?? null,
    idempotencyKey,
    projectionVersion: input.projectionVersion ?? 1,
    regeneratesFromProjectionId: input.regeneratesFromProjectionId ?? null,
    patientSharingEnabled: false,
    shadowMode: shadowPolicy?.active === true,
  };

  if (failedChecks.length > 0) {
    return {
      ok: false,
      errors: failedChecks.map((f) => ({ code: f.check, message: f.detail })),
      providerId: instrumented.providerId,
      latencyMs: instrumented.latencyMs,
      degradable: true,
      projection,
      auditHints,
    };
  }

  // 2D provider-output validation — malformed output → failed (not clinician_review).
  const resultMeta = result as {
    mimeType?: string;
    fileSizeBytes?: number;
    widthPx?: number;
    heightPx?: number;
  };
  if (input.outputValidation || (requireValidImageAsset && resultMeta.mimeType)) {
    const ov = validateProviderProjectionOutput({
      caseId: input.caseId,
      attemptId: projection.id,
      expectedProviderRequestId: result.providerRequestId ?? null,
      actualProviderRequestId:
        input.outputValidation?.actualProviderRequestId ?? result.providerRequestId ?? null,
      mimeType: input.outputValidation?.mimeType ?? resultMeta.mimeType ?? null,
      fileSizeBytes: input.outputValidation?.fileSizeBytes ?? resultMeta.fileSizeBytes ?? null,
      widthPx: input.outputValidation?.widthPx ?? resultMeta.widthPx ?? null,
      heightPx: input.outputValidation?.heightPx ?? resultMeta.heightPx ?? null,
      outputChecksum: result.outputChecksum,
      storageChecksumRecorded:
        input.outputValidation?.storageChecksumRecorded ?? Boolean(result.outputChecksum),
      safetyMetadataPresent: input.outputValidation?.safetyMetadataPresent ?? true,
      malformedOrExecutablePayload:
        input.outputValidation?.malformedOrExecutablePayload ?? false,
      unexpectedEmbeddedPatientData:
        input.outputValidation?.unexpectedEmbeddedPatientData ?? false,
      maxFileSizeBytes: input.outputValidation?.maxFileSizeBytes,
      expectedMinWidth: input.outputValidation?.expectedMinWidth,
      expectedMinHeight: input.outputValidation?.expectedMinHeight,
      expectedMaxWidth: input.outputValidation?.expectedMaxWidth,
      expectedMaxHeight: input.outputValidation?.expectedMaxHeight,
    });
    projection = applyOutputValidationToProjection(projection, ov);
    if (!ov.ok) {
      auditHints.push({
        eventType: "projection_output_validation_failed",
        metadata: {
          checks: ov.failures.map((f) => f.check),
          failureCode: ov.failureCode,
          contactedProvider: true,
        },
      });
      return {
        ok: false,
        errors: ov.failures.map((f) => ({ code: f.check, message: f.detail })),
        providerId: instrumented.providerId,
        latencyMs: instrumented.latencyMs,
        degradable: true,
        projection,
        auditHints,
      };
    }
  }

  projection = applyShadowModeToProjection(projection, shadowPolicy);

  auditHints.push({
    eventType: "projection_clinician_review_opened",
    metadata: {
      projectionId: projection.id,
      inputChecksum,
      shadowMode: projection.shadowMode === true,
    },
  });

  return {
    ok: true,
    projection,
    providerId: instrumented.providerId,
    latencyMs: instrumented.latencyMs,
    auditHints,
  };
}

function buildFailedProjection(
  input: RequestPreSurgeryProjectionInput,
  args: {
    status: PreSurgeryIllustrativeProjection["status"];
    now: string;
    providerId: string;
    modelVersion: string;
    failureCode: string;
    failureMessage: string;
    inputChecksum: string;
    inputSnapshot?: Record<string, unknown> | null;
    idempotencyKey?: string | null;
  }
): PreSurgeryIllustrativeProjection {
  return {
    id: input.id ?? crypto.randomUUID(),
    caseId: input.caseId,
    graftPlanId: input.plan.id,
    graftPlanVersion: input.plan.version,
    sourceImageId: input.sourceReview.imageId,
    mode: input.mode,
    patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS[input.mode],
    patientSafeDisclaimer: patientSafeDisclaimerForMode(input.mode),
    status: args.status,
    engineVersion: PRE_SURGERY_PROJECTION_ENGINE_VERSION,
    generationVersion: PRE_SURGERY_PROJECTION_ENGINE_VERSION,
    safetyLabelVersion: PRE_SURGERY_PROJECTION_SAFETY_LABEL_VERSION,
    generationPolicyVersion: PRE_SURGERY_PROJECTION_GENERATION_POLICY_VERSION,
    deterministicSeed: input.deterministicSeed ?? null,
    storagePath: null,
    validationPass: [],
    limitations: [],
    planningAssumptions: [],
    requestedBy: input.requestedBy,
    requestedAt: args.now,
    generatedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    inputChecksum: args.inputChecksum,
    inputSnapshot: args.inputSnapshot ?? null,
    outputChecksum: null,
    providerId: args.providerId,
    providerModelVersion: args.modelVersion,
    idempotencyKey: args.idempotencyKey ?? null,
    projectionVersion: input.projectionVersion ?? 1,
    regeneratesFromProjectionId: input.regeneratesFromProjectionId ?? null,
    patientSharingEnabled: false,
    failureCode: args.failureCode,
    failureMessage: args.failureMessage,
  };
}

// Re-export approval helpers from dedicated module for stable public API.
export {
  approveIllustrativeProjection,
  approveIllustrativeProjectionWithChecklist,
  rejectIllustrativeProjection,
  supersedeApprovedProjection,
  emptyApprovalChecklist,
  APPROVAL_CHECKLIST_KEYS,
  REJECTION_REASONS,
} from "./approval";

/** Create a regeneration attempt from a rejected/failed projection (never overwrites). */
export function buildRegenerationSeed(from: PreSurgeryIllustrativeProjection): {
  regeneratesFromProjectionId: string;
  projectionVersion: number;
  mode: PreSurgeryProjectionMode;
  graftPlanId: string;
  sourceImageId: string;
} {
  return {
    regeneratesFromProjectionId: from.id,
    projectionVersion: (from.projectionVersion ?? 1) + 1,
    mode: from.mode,
    graftPlanId: from.graftPlanId,
    sourceImageId: from.sourceImageId,
  };
}
