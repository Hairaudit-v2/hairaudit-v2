/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C / OPENAI-IMAGE-PROVIDER-2B — Projection provider configuration.
 *
 * openai is the photorealistic image-edit provider for Illustrative Projected Outcome.
 * local-illustrative is an overlay renderer for Graft Allocation Map / Proposed Hairline Design only.
 * ImagingOS fields remain for optional future use.
 * Do NOT fall back to coloured-block overlays when a cosmetic projection provider is unavailable.
 */

export type ProjectionProviderKind =
  | "stub"
  | "openai"
  | "imagingos"
  | "local_illustrative"
  | "disabled";

export type ResolvedProjectionProviderConfig = {
  kind: ProjectionProviderKind;
  providerId: string;
  modelVersion: string;
  endpoint: string | null;
  authTokenConfigured: boolean;
  signingSecretConfigured: boolean;
  connectTimeoutMs: number;
  generationTimeoutMs: number;
  maxRetries: number;
  allowStubFallback: boolean;
  callbackReplayTtlSeconds: number;
};

export const HA_PRE_SURGERY_PROJECTION_PROVIDER_ENV = "HA_PRE_SURGERY_PROJECTION_PROVIDER" as const;
export const HA_OPENAI_GPT_IMAGE_MODEL_ENV = "HA_OPENAI_GPT_IMAGE_MODEL" as const;
export const OPENAI_API_KEY_ENV = "OPENAI_API_KEY" as const;
export const HA_IMAGINGOS_PROJECTION_URL_ENV = "HA_IMAGINGOS_PROJECTION_URL" as const;
export const HA_IMAGINGOS_PROJECTION_TOKEN_ENV = "HA_IMAGINGOS_PROJECTION_TOKEN" as const;
export const HA_IMAGINGOS_PROJECTION_SIGNING_SECRET_ENV =
  "HA_IMAGINGOS_PROJECTION_SIGNING_SECRET" as const;
export const HA_IMAGINGOS_PROJECTION_MODEL_ENV = "HA_IMAGINGOS_PROJECTION_MODEL" as const;
export const HA_IMAGINGOS_PROJECTION_TIMEOUT_MS_ENV =
  "HA_IMAGINGOS_PROJECTION_TIMEOUT_MS" as const;
export const HA_IMAGINGOS_PROJECTION_CONNECT_TIMEOUT_MS_ENV =
  "HA_IMAGINGOS_PROJECTION_CONNECT_TIMEOUT_MS" as const;
export const HA_PRE_SURGERY_PROJECTION_ALLOW_STUB_FALLBACK_ENV =
  "HA_PRE_SURGERY_PROJECTION_ALLOW_STUB_FALLBACK" as const;

const DEFAULT_GENERATION_TIMEOUT_MS = 30_000;
const DEFAULT_OPENAI_GENERATION_TIMEOUT_MS = 180_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_CALLBACK_REPLAY_TTL = 600;
const DEFAULT_OPENAI_GPT_IMAGE_MODEL = "gpt-image-2";
const OPENAI_GPT_IMAGE_PROVIDER_ID = "openai-gpt-image";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveProjectionProviderConfig(
  env: NodeJS.ProcessEnv = process.env
): ResolvedProjectionProviderConfig {
  // Default remains local_illustrative for overlay maps; cosmetic outcome prefers OpenAI when keyed.
  const rawKind = (env[HA_PRE_SURGERY_PROJECTION_PROVIDER_ENV] ?? "local_illustrative")
    .trim()
    .toLowerCase();
  const kind: ProjectionProviderKind =
    rawKind === "openai" ||
    rawKind === "imagingos" ||
    rawKind === "disabled" ||
    rawKind === "stub" ||
    rawKind === "local_illustrative"
      ? rawKind
      : "local_illustrative";

  const endpoint = (env[HA_IMAGINGOS_PROJECTION_URL_ENV] ?? "").trim() || null;
  const token = (env[HA_IMAGINGOS_PROJECTION_TOKEN_ENV] ?? "").trim();
  const signingSecret = (env[HA_IMAGINGOS_PROJECTION_SIGNING_SECRET_ENV] ?? "").trim();
  const imagingOsModelVersion =
    (env[HA_IMAGINGOS_PROJECTION_MODEL_ENV] ?? "").trim() || "imagingos-projection-v1";
  const allowStubFallback =
    (env[HA_PRE_SURGERY_PROJECTION_ALLOW_STUB_FALLBACK_ENV] ?? "").trim().toLowerCase() ===
    "true";

  if (kind === "disabled") {
    return {
      kind: "disabled",
      providerId: "disabled",
      modelVersion: "none",
      endpoint: null,
      authTokenConfigured: false,
      signingSecretConfigured: false,
      connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
      generationTimeoutMs: DEFAULT_GENERATION_TIMEOUT_MS,
      maxRetries: 0,
      allowStubFallback: false,
      callbackReplayTtlSeconds: DEFAULT_CALLBACK_REPLAY_TTL,
    };
  }

  if (kind === "openai") {
    const openAiModel =
      (env[HA_OPENAI_GPT_IMAGE_MODEL_ENV] ?? "").trim() || DEFAULT_OPENAI_GPT_IMAGE_MODEL;
    return {
      kind: "openai",
      providerId: OPENAI_GPT_IMAGE_PROVIDER_ID,
      modelVersion: openAiModel,
      endpoint: null,
      authTokenConfigured: openaiCredentialsPresent(env),
      signingSecretConfigured: false,
      connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
      generationTimeoutMs: parsePositiveInt(
        env[HA_IMAGINGOS_PROJECTION_TIMEOUT_MS_ENV],
        DEFAULT_OPENAI_GENERATION_TIMEOUT_MS
      ),
      maxRetries: DEFAULT_MAX_RETRIES,
      allowStubFallback: false,
      callbackReplayTtlSeconds: DEFAULT_CALLBACK_REPLAY_TTL,
    };
  }

  if (kind === "imagingos") {
    return {
      kind: "imagingos",
      providerId: "imagingos-v1",
      modelVersion: imagingOsModelVersion,
      endpoint,
      authTokenConfigured: Boolean(token),
      signingSecretConfigured: Boolean(signingSecret),
      connectTimeoutMs: parsePositiveInt(
        env[HA_IMAGINGOS_PROJECTION_CONNECT_TIMEOUT_MS_ENV],
        DEFAULT_CONNECT_TIMEOUT_MS
      ),
      generationTimeoutMs: parsePositiveInt(
        env[HA_IMAGINGOS_PROJECTION_TIMEOUT_MS_ENV],
        DEFAULT_GENERATION_TIMEOUT_MS
      ),
      maxRetries: DEFAULT_MAX_RETRIES,
      allowStubFallback,
      callbackReplayTtlSeconds: DEFAULT_CALLBACK_REPLAY_TTL,
    };
  }

  if (kind === "stub") {
    return {
      kind: "stub",
      providerId: "stub-v1",
      modelVersion: "stub-v1",
      endpoint: null,
      authTokenConfigured: false,
      signingSecretConfigured: false,
      connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
      generationTimeoutMs: parsePositiveInt(
        env[HA_IMAGINGOS_PROJECTION_TIMEOUT_MS_ENV],
        12_000
      ),
      maxRetries: 0,
      allowStubFallback: true,
      callbackReplayTtlSeconds: DEFAULT_CALLBACK_REPLAY_TTL,
    };
  }

  // local_illustrative — overlay Graft Allocation Map / Hairline Design only
  return {
    kind: "local_illustrative",
    providerId: "local-illustrative-v1",
    modelVersion: "local-illustrative-v1",
    endpoint: null,
    authTokenConfigured: false,
    signingSecretConfigured: false,
    connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
    generationTimeoutMs: parsePositiveInt(
      env[HA_IMAGINGOS_PROJECTION_TIMEOUT_MS_ENV],
      30_000
    ),
    maxRetries: 0,
    allowStubFallback: false,
    callbackReplayTtlSeconds: DEFAULT_CALLBACK_REPLAY_TTL,
  };
}

export function openaiCredentialsPresent(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env[OPENAI_API_KEY_ENV] ?? "").trim());
}

export function openaiConfigReady(config: ResolvedProjectionProviderConfig): boolean {
  return config.kind === "openai" && config.authTokenConfigured;
}

export function imagingosConfigReady(config: ResolvedProjectionProviderConfig): boolean {
  return (
    config.kind === "imagingos" &&
    Boolean(config.endpoint) &&
    config.authTokenConfigured
  );
}

/** ImagingOS credentials present even when env kind is not imagingos (for optional cosmetic gate). */
export function imagingOsCredentialsPresent(env: NodeJS.ProcessEnv = process.env): boolean {
  const endpoint = (env[HA_IMAGINGOS_PROJECTION_URL_ENV] ?? "").trim();
  const token = (env[HA_IMAGINGOS_PROJECTION_TOKEN_ENV] ?? "").trim();
  return Boolean(endpoint && token);
}
