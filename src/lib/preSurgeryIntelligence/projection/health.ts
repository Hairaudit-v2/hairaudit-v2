/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C / OPENAI-IMAGE-PROVIDER-2B — Provider health and selection.
 *
 * Overlay renderer (local-illustrative) = Graft Allocation Map / Proposed Hairline Design only.
 * Cosmetic projected outcome = OpenAI gpt-image when keyed; ImagingOS when kind=imagingos and ready.
 * Never fall back to coloured-block overlays for cosmetic outcomes.
 */

import type { PreSurgeryProjectionProvider, PreSurgeryProjectionInput, PreSurgeryProjectionResult } from "./provider";
import { createStubPreSurgeryProjectionProvider } from "./stubProvider";
import { createImagingOsPreSurgeryProjectionProvider } from "./imagingOsProvider";
import {
  LOCAL_ILLUSTRATIVE_MODEL_VERSION,
  LOCAL_ILLUSTRATIVE_PROVIDER_ID,
} from "./localIllustrativeProvider";
import {
  imagingOsCredentialsPresent,
  imagingosConfigReady,
  openaiConfigReady,
  openaiCredentialsPresent,
  resolveProjectionProviderConfig,
  type ResolvedProjectionProviderConfig,
} from "./config";
import { PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE } from "./artifactTypes";

export type ProjectionProviderHealth = {
  providerId: string;
  healthy: boolean;
  latencyMs: number | null;
  checkedAt: string;
  detail: string;
};

export const DEFAULT_PROJECTION_TIMEOUT_MS = 12_000;

/** Expected ids from openaiGptImageProvider.ts (parent-owned module). */
const OPENAI_GPT_IMAGE_PROVIDER_ID = "openai-gpt-image";
const OPENAI_GPT_IMAGE_MODEL_DEFAULT = "gpt-image-2";

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
  /** True when the route must bind case-files storage before generating. */
  requiresStorageBinding: boolean;
};

export type CosmeticOutcomeProviderAudit = {
  configuredKind: string;
  imagingOsUrlConfigured: boolean;
  imagingOsTokenConfigured: boolean;
  imagingOsEnabled: boolean;
  openAiKeyConfigured: boolean;
};

export type CosmeticOutcomeProviderResolution =
  | {
      available: true;
      providerId: string;
      provider: PreSurgeryProjectionProvider;
      modelVersion: string;
      config: ResolvedProjectionProviderConfig;
      requiresStorageBinding: boolean;
    }
  | {
      available: false;
      providerId: string;
      message: typeof PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE;
      reason:
        | "credentials_missing"
        | "openai_key_missing"
        | "provider_disabled"
        | "misconfigured"
        | "stub_only";
      audit: CosmeticOutcomeProviderAudit;
    };

function localIllustrativeUnresolvedProvider(): PreSurgeryProjectionProvider {
  return {
    async generateProjection() {
      return {
        ok: false,
        errorCode: "provider_storage_unbound",
        message:
          "local-illustrative-v1 requires storage binding in the API route before generation",
        retryable: false,
      };
    },
  };
}

function openAiUnresolvedProvider(): PreSurgeryProjectionProvider {
  return {
    async generateProjection() {
      return {
        ok: false,
        errorCode: "provider_storage_unbound",
        message:
          "openai-gpt-image requires storage binding in the API route before generation",
        retryable: false,
      };
    },
    async healthcheck() {
      return {
        healthy: Boolean((process.env.OPENAI_API_KEY ?? "").trim()),
        detail: "openai-gpt-image (unbound; route must bind storage)",
        latencyMs: 0,
      };
    },
  };
}

function createUnavailableCosmeticProvider(): PreSurgeryProjectionProvider {
  return {
    async generateProjection() {
      return {
        ok: false,
        errorCode: "imaging_provider_not_configured",
        message: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
        retryable: false,
      };
    },
    async healthcheck() {
      return {
        healthy: false,
        detail: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
        latencyMs: 0,
      };
    },
  };
}

function buildOpenAiRuntimeConfig(
  env: NodeJS.ProcessEnv,
  configured: ResolvedProjectionProviderConfig
): ResolvedProjectionProviderConfig {
  const modelVersion =
    (env.HA_OPENAI_GPT_IMAGE_MODEL ?? "").trim() ||
    (configured.kind === "openai" ? configured.modelVersion : "") ||
    OPENAI_GPT_IMAGE_MODEL_DEFAULT;
  return {
    ...configured,
    kind: "openai",
    providerId: OPENAI_GPT_IMAGE_PROVIDER_ID,
    modelVersion,
    endpoint: null,
    authTokenConfigured: openaiCredentialsPresent(env),
    signingSecretConfigured: false,
    allowStubFallback: false,
  };
}

/** Overlay maps only — never used for Illustrative Projected Outcome. */
export function resolveOverlayRendererProvider(
  env: NodeJS.ProcessEnv = process.env
): ResolvedRuntimeProvider {
  const config = resolveProjectionProviderConfig({
    ...env,
    HA_PRE_SURGERY_PROJECTION_PROVIDER: "local_illustrative",
  });
  return {
    providerId: LOCAL_ILLUSTRATIVE_PROVIDER_ID,
    provider: localIllustrativeUnresolvedProvider(),
    config,
    modelVersion: LOCAL_ILLUSTRATIVE_MODEL_VERSION,
    disabled: false,
    requiresStorageBinding: true,
  };
}

/**
 * Photorealistic projected-outcome provider.
 * Prefers OpenAI when keyed (kind openai / local_illustrative / unset-equivalent).
 * Falls back to ImagingOS only when kind is imagingos and ready.
 * Does not fall back to local-illustrative colour blocks.
 */
export function resolveCosmeticOutcomeProvider(
  env: NodeJS.ProcessEnv = process.env
): CosmeticOutcomeProviderResolution {
  const configured = resolveProjectionProviderConfig(env);
  const urlConfigured = Boolean((env.HA_IMAGINGOS_PROJECTION_URL ?? "").trim());
  const tokenConfigured = Boolean((env.HA_IMAGINGOS_PROJECTION_TOKEN ?? "").trim());
  const imagingOsEnabled =
    (env.HA_PRE_SURGERY_IMAGINGOS_ENABLED ?? "").trim().toLowerCase() === "true";
  const openAiKeyConfigured = openaiCredentialsPresent(env);
  const audit: CosmeticOutcomeProviderAudit = {
    configuredKind: configured.kind,
    imagingOsUrlConfigured: urlConfigured,
    imagingOsTokenConfigured: tokenConfigured,
    imagingOsEnabled,
    openAiKeyConfigured,
  };

  if (configured.kind === "disabled") {
    return {
      available: false,
      providerId: "disabled",
      message: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
      reason: "provider_disabled",
      audit,
    };
  }

  if (configured.kind === "stub") {
    return {
      available: false,
      providerId: "stub-v1",
      message: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
      reason: "stub_only",
      audit,
    };
  }

  // Explicit openai without key — fail closed with specific reason.
  if (configured.kind === "openai" && !openAiKeyConfigured) {
    return {
      available: false,
      providerId: OPENAI_GPT_IMAGE_PROVIDER_ID,
      message: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
      reason: "openai_key_missing",
      audit,
    };
  }

  // Prefer OpenAI when key present and kind is openai, local_illustrative, or
  // unset-equivalent (defaults to local_illustrative).
  const preferOpenAi =
    openAiKeyConfigured &&
    (configured.kind === "openai" || configured.kind === "local_illustrative");

  if (preferOpenAi || (configured.kind === "openai" && openAiKeyConfigured)) {
    const openAiConfig = buildOpenAiRuntimeConfig(env, configured);
    return {
      available: true,
      providerId: openAiConfig.providerId,
      provider: openAiUnresolvedProvider(),
      modelVersion: openAiConfig.modelVersion,
      config: openAiConfig,
      requiresStorageBinding: true,
    };
  }

  // ImagingOS only when explicitly configured as such and ready.
  if (configured.kind === "imagingos") {
    if (!imagingOsCredentialsPresent(env)) {
      return {
        available: false,
        providerId: "imagingos-v1",
        message: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
        reason: "credentials_missing",
        audit,
      };
    }

    const imagingConfig: ResolvedProjectionProviderConfig = {
      ...configured,
      kind: "imagingos",
      providerId: "imagingos-v1",
      modelVersion:
        (env.HA_IMAGINGOS_PROJECTION_MODEL ?? "").trim() ||
        configured.modelVersion ||
        "imagingos-projection-v1",
      endpoint: (env.HA_IMAGINGOS_PROJECTION_URL ?? "").trim() || null,
      authTokenConfigured: true,
    };

    if (!imagingosConfigReady(imagingConfig)) {
      return {
        available: false,
        providerId: "imagingos-v1",
        message: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
        reason: "misconfigured",
        audit,
      };
    }

    const token = (env.HA_IMAGINGOS_PROJECTION_TOKEN ?? "").trim();
    const signingSecret = (env.HA_IMAGINGOS_PROJECTION_SIGNING_SECRET ?? "").trim() || null;
    return {
      available: true,
      providerId: imagingConfig.providerId,
      provider: createImagingOsPreSurgeryProjectionProvider({
        config: imagingConfig,
        authToken: token,
        signingSecret,
      }),
      modelVersion: imagingConfig.modelVersion,
      config: imagingConfig,
      requiresStorageBinding: false,
    };
  }

  // local_illustrative without OpenAI key — cosmetic outcome unavailable (never overlay fallback).
  return {
    available: false,
    providerId: OPENAI_GPT_IMAGE_PROVIDER_ID,
    message: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
    reason: "credentials_missing",
    audit,
  };
}

/**
 * Legacy resolver used by routes that still call the generic path.
 * ImagingOS / OpenAI misconfiguration no longer falls back to coloured-block overlays for "projection".
 */
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
      requiresStorageBinding: false,
    };
  }

  if (config.kind === "openai") {
    if (openaiConfigReady(config) || openaiCredentialsPresent(env)) {
      const openAiConfig = buildOpenAiRuntimeConfig(env, config);
      return {
        providerId: openAiConfig.providerId,
        provider: openAiUnresolvedProvider(),
        config: openAiConfig,
        modelVersion: openAiConfig.modelVersion,
        disabled: false,
        // Source bytes + store binding required before generation.
        requiresStorageBinding: true,
      };
    }
    return {
      providerId: OPENAI_GPT_IMAGE_PROVIDER_ID,
      provider: createUnavailableCosmeticProvider(),
      config: { ...config, kind: "disabled", providerId: OPENAI_GPT_IMAGE_PROVIDER_ID },
      modelVersion: config.modelVersion,
      disabled: true,
      requiresStorageBinding: true,
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
        requiresStorageBinding: false,
      };
    }
    // Explicit stub fallback only when configured — never silent overlay substitute for cosmetic.
    if (config.allowStubFallback) {
      return {
        providerId: "stub-v1",
        provider: createStubPreSurgeryProjectionProvider(),
        config: { ...config, kind: "stub", providerId: "stub-v1" },
        modelVersion: "stub-v1",
        disabled: false,
        requiresStorageBinding: false,
      };
    }
    // PHOTOREALISTIC-OUTCOME-2A: hard-unavailable — do not fall back to local-illustrative.
    return {
      providerId: "imagingos-v1",
      provider: createUnavailableCosmeticProvider(),
      config: { ...config, kind: "disabled", providerId: "imagingos-v1" },
      modelVersion: config.modelVersion,
      disabled: true,
      requiresStorageBinding: false,
    };
  }

  if (config.kind === "stub") {
    return {
      providerId: "stub-v1",
      provider: createStubPreSurgeryProjectionProvider(),
      config,
      modelVersion: "stub-v1",
      disabled: false,
      requiresStorageBinding: false,
    };
  }

  // local_illustrative — overlay renderer only
  return {
    providerId: LOCAL_ILLUSTRATIVE_PROVIDER_ID,
    provider: localIllustrativeUnresolvedProvider(),
    config,
    modelVersion: LOCAL_ILLUSTRATIVE_MODEL_VERSION,
    disabled: false,
    requiresStorageBinding: true,
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
            : code === "imaging_provider_not_configured"
              ? PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE
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
