/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Projection request orchestration.
 * 2B: instrumented provider calls with timeout + safe failure degradation.
 */

import { createHash } from "node:crypto";
import { stableStringifyForChecksum } from "@/lib/projection/canonicalChecksum";
import { PRE_SURGERY_PROJECTION_ENGINE_VERSION } from "../versions";
import {
  PRE_SURGERY_PROJECTION_PATIENT_LABELS,
  type ClinicalImageAnnotation,
  type ClinicalImageReview,
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
  getDefaultPreSurgeryProjectionProvider,
  runInstrumentedProjection,
} from "./health";

export type RequestPreSurgeryProjectionInput = {
  caseId: string;
  plan: PreSurgeryGraftPlan;
  sourceReview: ClinicalImageReview;
  sourceImageRef: string;
  approvedAnnotations: ClinicalImageAnnotation[];
  mode: PreSurgeryProjectionMode;
  requiredImagesPresent: boolean;
  proposedHairlineConfirmed: boolean;
  treatmentAreaConfirmed: boolean;
  requestedBy: string;
  deterministicSeed?: string | null;
  provider?: PreSurgeryProjectionProvider;
  providerId?: string;
  timeoutMs?: number;
  now?: string;
  id?: string;
};

export type RequestPreSurgeryProjectionResult =
  | {
      ok: true;
      projection: PreSurgeryIllustrativeProjection;
      providerId: string;
      latencyMs: number;
    }
  | {
      ok: false;
      errors: Array<{ code: string; message: string }>;
      providerId?: string;
      latencyMs?: number;
      degradable?: boolean;
    };

export async function requestPreSurgeryProjection(
  input: RequestPreSurgeryProjectionInput
): Promise<RequestPreSurgeryProjectionResult> {
  const now = input.now ?? new Date().toISOString();
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
    return { ok: false, errors: gates.map((g) => ({ code: g.code, message: g.message })) };
  }

  const label = PRE_SURGERY_PROJECTION_PATIENT_LABELS[input.mode];
  const labelViolation = findUnsafeProjectionLabel(label);
  if (labelViolation) {
    return { ok: false, errors: [{ code: labelViolation.code, message: labelViolation.message }] };
  }

  const allocation = deriveProjectionModeAllocation(input.plan, input.mode);
  const inputChecksum = createHash("sha256")
    .update(
      stableStringifyForChecksum({
        planId: input.plan.id,
        planVersion: input.plan.version,
        planChecksum: input.plan.checksum,
        sourceImageId: input.sourceReview.imageId,
        mode: input.mode,
        allocation,
      }),
      "utf8"
    )
    .digest("hex");

  const defaults = getDefaultPreSurgeryProjectionProvider();
  const provider = input.provider ?? defaults.provider;
  const providerId = input.providerId ?? defaults.providerId;

  const instrumented = await runInstrumentedProjection(
    provider,
    providerId,
    {
      caseId: input.caseId,
      sourceImageId: input.sourceReview.imageId,
      sourceImageRef: input.sourceImageRef,
      approvedGraftPlanId: input.plan.id,
      approvedGraftPlan: input.plan,
      approvedAnnotations: input.approvedAnnotations.filter((a) => a.approved && !a.deletedAt),
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
    },
    { timeoutMs: input.timeoutMs }
  );

  if (!instrumented.ok) {
    return {
      ok: false,
      errors: [{ code: instrumented.errorCode, message: instrumented.message }],
      providerId: instrumented.providerId,
      latencyMs: instrumented.latencyMs,
      degradable: true,
    };
  }

  const result = instrumented.result;
  const hairlineAnnotationPresent = input.approvedAnnotations.some(
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
  });

  const failed = validationPass.filter((v) => !v.passed);
  const projection: PreSurgeryIllustrativeProjection = {
    id: input.id ?? crypto.randomUUID(),
    caseId: input.caseId,
    graftPlanId: input.plan.id,
    graftPlanVersion: input.plan.version,
    sourceImageId: input.sourceReview.imageId,
    mode: input.mode,
    patientSafeLabel: label,
    status: failed.length > 0 ? "validation_failed" : "generated",
    engineVersion: PRE_SURGERY_PROJECTION_ENGINE_VERSION,
    generationVersion: PRE_SURGERY_PROJECTION_ENGINE_VERSION,
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
    outputChecksum: result.outputChecksum,
  };

  if (failed.length > 0) {
    return {
      ok: false,
      errors: failed.map((f) => ({ code: f.check, message: f.detail })),
      providerId: instrumented.providerId,
      latencyMs: instrumented.latencyMs,
      degradable: true,
    };
  }

  return {
    ok: true,
    projection,
    providerId: instrumented.providerId,
    latencyMs: instrumented.latencyMs,
  };
}

/** Clinician must explicitly approve before any patient-facing exposure. */
export function approveIllustrativeProjection(
  projection: PreSurgeryIllustrativeProjection,
  approvedBy: string,
  now = new Date().toISOString()
): PreSurgeryIllustrativeProjection | { error: string } {
  if (projection.status !== "generated") {
    return { error: "Only generated projections can be approved for patient visibility" };
  }
  if (findUnsafeProjectionLabel(projection.patientSafeLabel)) {
    return { error: "Projection label fails patient-safe wording checks" };
  }
  return {
    ...projection,
    status: "approved",
    approvedBy,
    approvedAt: now,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
  };
}

export function rejectIllustrativeProjection(
  projection: PreSurgeryIllustrativeProjection,
  rejectedBy: string,
  reason: string,
  now = new Date().toISOString()
): PreSurgeryIllustrativeProjection {
  return {
    ...projection,
    status: "rejected",
    rejectedBy,
    rejectedAt: now,
    rejectionReason: reason,
  };
}
