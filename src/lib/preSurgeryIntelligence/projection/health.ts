/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Projection provider health, timeout, and selection.
 * Stub remains local-dev default; ImagingOS only when explicitly configured.
 */

import type { PreSurgeryProjectionProvider, PreSurgeryProjectionInput, PreSurgeryProjectionResult } from "./provider";
import { createStubPreSurgeryProjectionProvider } from "./stubProvider";
import { createImagingOsPreSurgeryProjectionProvider } from "./imagingOsProvider";
import {
  imagingosConfigReady,
  resolveProjectionProviderConfig,
  type ResolvedProjectionProviderConfig,
} from "./config";

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
      providerRequestId?: string | null;
      providerResponseId?: string | null;
    };

export type ResolvedRuntimeProvider = {
  providerId: string;
  provider: PreSurgeryProjectionProvider;
  config: ResolvedProjectionProviderConfig;
  modelVersion: string;
  disabled: boolean;
};

export function resolveRuntimeProjectionProvider(
  env: NodeJS.ProcessEnv = process.env
): ResolvedRuntimeProvider {
  const config = resolveProjectionProviderConfig(env);

  if (config.kind === "disabled") {
    return {
      providerId: "disabled",
      provider: createDisabledProvider(),
      config,
      modelVersion: "none",
      disabled: true,
    };
  }

  if (config.kind === "imagingos") {
    if (imagingosConfigReady(config)) {
      const token = (env.HA_IMAGINGOS_PROJECTION_TOKEN ?? "").trim();
      const signingSecret = (env.HA_IMAGINGOS_PROJECTION_SIGNING_SECRET ?? "").trim() || null;
      return {
        providerId: config.providerId,
        provider: createImagingOsPreSurgeryProjectionProvider({
          config,
          authToken: token,
          signingSecret,
        }),
        config,
        modelVersion: config.modelVersion,
        disabled: false,
      };
    }
    // Explicit stub fallback only when configured — never silent production substitute.
    if (config.allowStubFallback) {
      return {
        providerId: "stub-v1",
        provider: createStubPreSurgeryProjectionProvider(),
        config: { ...config, kind: "stub", providerId: "stub-v1" },
        modelVersion: "stub-v1",
        disabled: false,
      };
    }
    return {
      providerId: "disabled",
      provider: createDisabledProvider("provider_misconfigured"),
      config,
      modelVersion: config.modelVersion,
      disabled: true,
    };
  }

  return {
    providerId: "stub-v1",
    provider: createStubPreSurgeryProjectionProvider(),
    config,
    modelVersion: "stub-v1",
    disabled: false,
  };
}

function createDisabledProvider(code = "provider_disabled"): PreSurgeryProjectionProvider {
  return {
    async generateProjection() {
      return {
        ok: false,
        errorCode: code,
        message:
          code === "provider_misconfigured"
            ? "ImagingOS projection provider is misconfigured"
            : "Projection provider is disabled",
        retryable: false,
      };
    },
  };
}

export function getDefaultPreSurgeryProjectionProvider(): {
  providerId: string;
  provider: PreSurgeryProjectionProvider;
} {
  const resolved = resolveRuntimeProjectionProvider();
  return { providerId: resolved.providerId, provider: resolved.provider };
}

export async function checkProjectionProviderHealth(
  provider: PreSurgeryProjectionProvider,
  providerId: string,
  opts?: { timeoutMs?: number; now?: string }
): Promise<ProjectionProviderHealth> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_PROJECTION_TIMEOUT_MS;
  const started = Date.now();

  if (provider.healthcheck) {
    try {
      const result = await withTimeout(provider.healthcheck(), timeoutMs, "provider_timeout");
      return {
        providerId,
        healthy: result.healthy,
        latencyMs: result.latencyMs,
        checkedAt: opts?.now ?? new Date().toISOString(),
        detail: result.detail,
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
  const controller = new AbortController();
  const mergedSignal = input.abortSignal
    ? anyAbortSignal([input.abortSignal, controller.signal])
    : controller.signal;

  try {
    const result = await withTimeout(
      provider.generateProjection({ ...input, abortSignal: mergedSignal }),
      timeoutMs,
      "provider_timeout"
    );
    const latencyMs = Date.now() - started;
    if (!result.ok) {
      return {
        ok: false,
        errorCode: result.errorCode,
        message: result.message,
        latencyMs,
        providerId,
        degradable: true,
        providerRequestId: result.providerRequestId ?? null,
        providerResponseId: result.providerResponseId ?? null,
      };
    }
    return { ok: true, result, latencyMs, providerId };
  } catch (e) {
    controller.abort();
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

function anyAbortSignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort();
      break;
    }
    s.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
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
