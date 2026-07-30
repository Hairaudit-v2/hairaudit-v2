/**
 * HA-PRE-SURGERY-INTELLIGENCE-2B — Projection provider health, timeout, and safe failure.
 * Stub remains the production-safe default until ImagingOS (2C).
 */

import type { PreSurgeryProjectionProvider, PreSurgeryProjectionInput, PreSurgeryProjectionResult } from "./provider";
import { createStubPreSurgeryProjectionProvider } from "./stubProvider";

export type ProjectionProviderHealth = {
  providerId: string;
  healthy: boolean;
  latencyMs: number | null;
  checkedAt: string;
  detail: string;
};

export const DEFAULT_PROJECTION_TIMEOUT_MS = 12_000;

export type InstrumentedProjectionOutcome =
  | {
      ok: true;
      result: Extract<PreSurgeryProjectionResult, { ok: true }>;
      latencyMs: number;
      providerId: string;
    }
  | {
      ok: false;
      errorCode: string;
      message: string;
      latencyMs: number;
      providerId: string;
      degradable: true;
    };

export function getDefaultPreSurgeryProjectionProvider(): {
  providerId: string;
  provider: PreSurgeryProjectionProvider;
} {
  // Production-safe default until HA-PRE-SURGERY-INTELLIGENCE-2C ImagingOS adapter.
  return {
    providerId: "stub-v1",
    provider: createStubPreSurgeryProjectionProvider(),
  };
}

export async function checkProjectionProviderHealth(
  provider: PreSurgeryProjectionProvider,
  providerId: string,
  opts?: { timeoutMs?: number; now?: string }
): Promise<ProjectionProviderHealth> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_PROJECTION_TIMEOUT_MS;
  const started = Date.now();
  const probeInput: PreSurgeryProjectionInput = {
    caseId: "00000000-0000-4000-8000-000000000000",
    sourceImageId: "00000000-0000-4000-8000-000000000001",
    sourceImageRef: "healthcheck:noop",
    approvedGraftPlanId: "00000000-0000-4000-8000-000000000002",
    approvedGraftPlan: {
      id: "00000000-0000-4000-8000-000000000002",
      caseId: "00000000-0000-4000-8000-000000000000",
      version: 1,
      schemaVersion: "ha-pre-surgery-graft-plan-v1",
      zones: [
        {
          zone: "hairline",
          priority: "essential",
          minimumGrafts: 100,
          targetGrafts: 200,
          maximumGrafts: 300,
          evidenceImageIds: ["00000000-0000-4000-8000-000000000001"],
        },
      ],
      totalMinimumGrafts: 100,
      totalTargetGrafts: 200,
      totalMaximumGrafts: 300,
      proposedSessionCount: 1,
      stageOneZones: ["hairline"],
      deferredZones: [],
      donorAvailabilityBand: "moderate",
      planningAssumptions: ["healthcheck"],
      status: "approved",
      createdBy: "healthcheck",
      createdAt: opts?.now ?? new Date().toISOString(),
      checksum: "healthcheck",
    },
    approvedAnnotations: [],
    mode: "planned",
    generationVersion: "healthcheck",
    engineVersion: "healthcheck",
    deterministicSeed: "healthcheck",
    patientSafeProjectionConstraints: ["healthcheck"],
  };

  try {
    const result = await withTimeout(provider.generateProjection(probeInput), timeoutMs, "provider_timeout");
    const latencyMs = Date.now() - started;
    if (!result.ok) {
      return {
        providerId,
        healthy: false,
        latencyMs,
        checkedAt: opts?.now ?? new Date().toISOString(),
        detail: result.message,
      };
    }
    return {
      providerId,
      healthy: true,
      latencyMs,
      checkedAt: opts?.now ?? new Date().toISOString(),
      detail: "ok",
    };
  } catch (e) {
    return {
      providerId,
      healthy: false,
      latencyMs: Date.now() - started,
      checkedAt: opts?.now ?? new Date().toISOString(),
      detail: e instanceof Error ? e.message : "healthcheck_failed",
    };
  }
}

export async function runInstrumentedProjection(
  provider: PreSurgeryProjectionProvider,
  providerId: string,
  input: PreSurgeryProjectionInput,
  opts?: { timeoutMs?: number }
): Promise<InstrumentedProjectionOutcome> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_PROJECTION_TIMEOUT_MS;
  const started = Date.now();
  try {
    const result = await withTimeout(provider.generateProjection(input), timeoutMs, "provider_timeout");
    const latencyMs = Date.now() - started;
    if (!result.ok) {
      return {
        ok: false,
        errorCode: result.errorCode,
        message: result.message,
        latencyMs,
        providerId,
        degradable: true,
      };
    }
    return { ok: true, result, latencyMs, providerId };
  } catch (e) {
    return {
      ok: false,
      errorCode: e instanceof Error && e.message === "provider_timeout" ? "provider_timeout" : "provider_failure",
      message: e instanceof Error ? e.message : "Projection provider failed",
      latencyMs: Date.now() - started,
      providerId,
      degradable: true,
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(code)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
