/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Projection provider configuration.
 *
 * Stub is the local-dev / test default. ImagingOS is used only when explicitly configured.
 * Stub must never silently become the production substitute unless
 * HA_PRE_SURGERY_PROJECTION_ALLOW_STUB_FALLBACK=true.
 */

export type ProjectionProviderKind = "stub" | "imagingos" | "disabled";

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
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_CALLBACK_REPLAY_TTL = 600;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveProjectionProviderConfig(
  env: NodeJS.ProcessEnv = process.env
): ResolvedProjectionProviderConfig {
  const rawKind = (env[HA_PRE_SURGERY_PROJECTION_PROVIDER_ENV] ?? "stub").trim().toLowerCase();
  const kind: ProjectionProviderKind =
    rawKind === "imagingos" || rawKind === "disabled" || rawKind === "stub"
      ? rawKind
      : "stub";

  const endpoint = (env[HA_IMAGINGOS_PROJECTION_URL_ENV] ?? "").trim() || null;
  const token = (env[HA_IMAGINGOS_PROJECTION_TOKEN_ENV] ?? "").trim();
  const signingSecret = (env[HA_IMAGINGOS_PROJECTION_SIGNING_SECRET_ENV] ?? "").trim();
  const modelVersion =
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

  if (kind === "imagingos") {
    return {
      kind: "imagingos",
      providerId: "imagingos-v1",
      modelVersion,
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

  // stub (default for local development / tests)
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

export function imagingosConfigReady(config: ResolvedProjectionProviderConfig): boolean {
  return (
    config.kind === "imagingos" &&
    Boolean(config.endpoint) &&
    config.authTokenConfigured
  );
}
