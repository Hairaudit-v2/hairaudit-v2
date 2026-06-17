/**
 * FI OS image classifier HTTP client — Phase 3E contract adapter
 *
 * Calls a configured internal FI image-classification endpoint only.
 * No direct OpenAI / Claude / Gemini imports or calls.
 *
 * See: docs/hairaudit-v2-phase-3e-fi-os-classifier-adapter.md
 */

import { isValidCanonicalPhotoCategory } from "./uploadContract";

export const FI_OS_IMAGE_CLASSIFIER_URL_ENV = "FI_OS_IMAGE_CLASSIFIER_URL" as const;
export const FI_OS_IMAGE_CLASSIFIER_TOKEN_ENV = "FI_OS_IMAGE_CLASSIFIER_TOKEN" as const;

const DEFAULT_TIMEOUT_MS = 5000;
const MIN_TIMEOUT_MS = 3000;
const MAX_TIMEOUT_MS = 8000;

export type FiOsClassifierConfigError =
  | "url_missing"
  | "token_missing"
  | "invalid_url"
  | "non_https_in_production"
  | "service_role_key_reused";

export type FiOsClassifierConfig = {
  url: string;
  token: string;
  timeoutMs: number;
};

export type FiOsClassifierConfigValidation =
  | { valid: true; config: FiOsClassifierConfig }
  | { valid: false; error: FiOsClassifierConfigError; message: string };

export type FiOsImageClassifierInput = {
  idempotency_key: string;
  source_case_id: string;
  source_upload_id: string;
  canonical_photo_category: string;
  legacy_upload_type?: string;
  storage_bucket?: string;
  storage_path?: string;
  image_content_type?: string | null;
  image_size_bytes?: number | null;
  processed_at?: string;
};

export type FiOsImageClassifierMappedResult = {
  classification_status: "classified";
  canonical_photo_category: string;
  confidence: number | null;
  quality_status: string;
  protocol_status: string;
  model_provider: "fi_os";
  model_version: string | null;
  classification_notes: string;
  dry_run: false;
  classification_source: "fi_os";
  processed_at: string;
};

export type FiOsImageClassifierOutcome =
  | { ok: true; result: FiOsImageClassifierMappedResult }
  | { ok: false; reason: string };

export type FiOsClassifierFetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const FI_CATEGORY_TO_CANONICAL: Record<string, string> = {
  front: "front",
  left_profile: "left",
  right_profile: "right",
  top: "top",
  crown: "crown",
  donor: "donor",
  graft_tray: "other",
  immediate_post_op: "other",
  follow_up: "other",
  microscopic: "other",
  unknown: "other",
};

function isProductionRuntime(env: NodeJS.ProcessEnv): boolean {
  return (env.NODE_ENV ?? "").trim() === "production";
}

function getServiceRoleKey(env: NodeJS.ProcessEnv): string | undefined {
  return env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

function containsServiceRoleKey(value: string, serviceRoleKey: string): boolean {
  return value.includes(serviceRoleKey);
}

export function resolveFiOsClassifierTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.FI_OS_IMAGE_CLASSIFIER_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(parsed)));
}

export function validateFiOsClassifierConfig(
  env: NodeJS.ProcessEnv = process.env
): FiOsClassifierConfigValidation {
  const url = env[FI_OS_IMAGE_CLASSIFIER_URL_ENV]?.trim() ?? "";
  const token = env[FI_OS_IMAGE_CLASSIFIER_TOKEN_ENV]?.trim() ?? "";

  if (!url) {
    return {
      valid: false,
      error: "url_missing",
      message: `${FI_OS_IMAGE_CLASSIFIER_URL_ENV} is required when HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os`,
    };
  }

  if (!token) {
    return {
      valid: false,
      error: "token_missing",
      message: `${FI_OS_IMAGE_CLASSIFIER_TOKEN_ENV} is required when HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os`,
    };
  }

  try {
    void new URL(url);
  } catch {
    return {
      valid: false,
      error: "invalid_url",
      message: `${FI_OS_IMAGE_CLASSIFIER_URL_ENV} is not a valid URL`,
    };
  }

  if (isProductionRuntime(env) && !url.startsWith("https://")) {
    return {
      valid: false,
      error: "non_https_in_production",
      message: `${FI_OS_IMAGE_CLASSIFIER_URL_ENV} must use HTTPS in production`,
    };
  }

  const serviceRoleKey = getServiceRoleKey(env);
  if (serviceRoleKey) {
    if (token === serviceRoleKey || containsServiceRoleKey(url, serviceRoleKey)) {
      return {
        valid: false,
        error: "service_role_key_reused",
        message: `${FI_OS_IMAGE_CLASSIFIER_TOKEN_ENV} must not reuse SUPABASE_SERVICE_ROLE_KEY`,
      };
    }
  }

  return {
    valid: true,
    config: {
      url,
      token,
      timeoutMs: resolveFiOsClassifierTimeoutMs(env),
    },
  };
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function mapFiCategoryToCanonical(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (isValidCanonicalPhotoCategory(normalized)) {
    return normalized;
  }
  return FI_CATEGORY_TO_CANONICAL[normalized] ?? "other";
}

type ParsedFiOsClassifierResponse = {
  canonical_photo_category: string;
  confidence: number | null;
  quality_status: string;
  protocol_status: string;
  model_version: string | null;
  classification_notes: string;
};

export function parseFiOsClassifierResponseBody(body: unknown): ParsedFiOsClassifierResponse | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;

  const directCategory =
    readNonEmptyString(record.canonical_photo_category) ??
    readNonEmptyString(record.category);

  if (!directCategory) {
    return null;
  }

  const canonical_photo_category = mapFiCategoryToCanonical(directCategory);

  const confidence =
    clampConfidence(record.confidence) ??
    clampConfidence(record.category_confidence) ??
    clampConfidence(record.categoryConfidence);

  const quality_status =
    readNonEmptyString(record.quality_status) ?? "not_evaluated";
  const protocol_status =
    readNonEmptyString(record.protocol_status) ?? "not_evaluated";

  const model_version =
    readNonEmptyString(record.model_version) ??
    readNonEmptyString(record.classifier_version) ??
    readNonEmptyString(record.classifierVersion) ??
    null;

  const classification_notes =
    readNonEmptyString(record.classification_notes) ??
    readNonEmptyString(record.notes) ??
    "classified via FI OS adapter";

  return {
    canonical_photo_category,
    confidence,
    quality_status,
    protocol_status,
    model_version,
    classification_notes,
  };
}

function buildRequestBody(input: FiOsImageClassifierInput): Record<string, unknown> {
  return {
    source_system: "hairaudit",
    idempotency_key: input.idempotency_key,
    source_case_id: input.source_case_id,
    source_upload_id: input.source_upload_id,
    canonical_photo_category: input.canonical_photo_category,
    ...(input.legacy_upload_type ? { legacy_upload_type: input.legacy_upload_type } : {}),
    ...(input.storage_bucket ? { storage_bucket: input.storage_bucket } : {}),
    ...(input.storage_path ? { storage_path: input.storage_path } : {}),
    ...(input.image_content_type ? { image_content_type: input.image_content_type } : {}),
    ...(input.image_size_bytes != null ? { image_size_bytes: input.image_size_bytes } : {}),
  };
}

/**
 * Call the configured FI OS image classifier endpoint and map the response
 * into the HairAudit intelligence result contract.
 */
export async function classifyWithFiOsImageClassifier(
  input: FiOsImageClassifierInput,
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: FiOsClassifierFetchImpl;
  } = {}
): Promise<FiOsImageClassifierOutcome> {
  const env = options.env ?? process.env;
  const validation = validateFiOsClassifierConfig(env);

  if (!validation.valid) {
    const reason =
      validation.error === "url_missing" || validation.error === "token_missing"
        ? "FI OS image classifier provider not configured"
        : validation.message;
    return { ok: false, reason };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "FI OS image classifier fetch is unavailable" };
  }

  const { url, token, timeoutMs } = validation.config;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(buildRequestBody(input)),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: `FI OS image classifier request failed (${response.status})`,
      };
    }

    let parsedBody: unknown;
    try {
      parsedBody = await response.json();
    } catch {
      return { ok: false, reason: "FI OS image classifier returned invalid JSON" };
    }

    const parsed = parseFiOsClassifierResponseBody(parsedBody);
    if (!parsed) {
      return { ok: false, reason: "FI OS image classifier returned an invalid response" };
    }

    return {
      ok: true,
      result: {
        classification_status: "classified",
        canonical_photo_category: parsed.canonical_photo_category,
        confidence: parsed.confidence,
        quality_status: parsed.quality_status,
        protocol_status: parsed.protocol_status,
        model_provider: "fi_os",
        model_version: parsed.model_version,
        classification_notes: parsed.classification_notes,
        dry_run: false,
        classification_source: "fi_os",
        processed_at: input.processed_at ?? new Date().toISOString(),
      },
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : "request-error";
    if (name === "AbortError") {
      return { ok: false, reason: "FI OS image classifier request timed out" };
    }
    return { ok: false, reason: "FI OS image classifier request failed" };
  } finally {
    clearTimeout(timer);
  }
}
