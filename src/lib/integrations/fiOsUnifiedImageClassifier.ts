/**
 * FIN-IMAGING-3 — HairAudit adapter for FI OS unified image classifier.
 *
 * Calls POST /api/internal/imaging/classify with source_system=hairaudit and maps
 * ImageClassificationResultV1 into HairAudit FI image-intelligence structures.
 *
 * Legacy route (/api/internal/hairaudit/image-classify) remains available via
 * fiOsImageClassifierClient.ts — do not remove.
 */

import { createHmac } from "node:crypto";

import {
  mapFiCategoryToCanonical,
  validateFiOsClassifierConfig,
  FI_OS_IMAGE_CLASSIFIER_TOKEN_ENV,
  FI_OS_IMAGE_CLASSIFIER_URL_ENV,
  type FiOsClassifierFetchImpl,
} from "@/lib/hairaudit/fiOsImageClassifierClient";
import type { FiImageIntelligenceResult } from "@/lib/hairaudit/fiImageIntelligenceResult";

export const FI_OS_UNIFIED_CLASSIFIER_PATH = "/api/internal/imaging/classify" as const;

export const FI_OS_IMAGE_CLASSIFIER_HMAC_SECRET_ENV = "FI_OS_IMAGE_CLASSIFIER_HMAC_SECRET" as const;
export const FI_OS_IMAGE_CLASSIFIER_REQUIRE_HMAC_ENV = "FI_OS_IMAGE_CLASSIFIER_REQUIRE_HMAC" as const;

export const FI_OS_IMAGING_HDR_TIMESTAMP = "x-fi-imaging-timestamp" as const;
export const FI_OS_IMAGING_HDR_SIGNATURE = "x-fi-imaging-signature" as const;
export const FI_OS_IMAGING_HDR_SOURCE_SYSTEM = "x-fi-source-system" as const;

/** Wire subset of ImageClassificationResultV1 — no @follicle/intelligence-core dependency in HairAudit. */
export type ImageClassificationResultV1Wire = {
  schemaVersion?: number;
  image_id?: string;
  classification_type?: string;
  category?: string;
  confidence?: number;
  orientation?: string;
  quality_score?: number;
  blur_score?: number;
  protocol_compliant?: boolean;
  capture_source?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type UnifiedImageClassifyResponseWire = {
  success?: boolean;
  classification?: ImageClassificationResultV1Wire;
  normalized_signal?: { schemaVersion?: number; source_system?: string };
  fallback_used?: boolean;
  provider?: string;
  processing_version?: string;
  warnings?: string[];
  generated_at?: string;
  error?: { code?: string; message?: string };
};

export type FiOsUnifiedClassifierInput = {
  source_image_id: string;
  case_id: string;
  patient_id?: string;
  canonical_photo_category: string;
  legacy_upload_type?: string;
  capture_source?: string;
  upload_source?: string;
  storage_bucket?: string;
  storage_path?: string;
  signed_url?: string;
  image_url?: string;
  image_content_type?: string | null;
  image_size_bytes?: number | null;
  idempotency_key: string;
  processed_at?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type FiOsUnifiedClassifierMappedResult = Pick<
  FiImageIntelligenceResult,
  | "classification_status"
  | "canonical_photo_category"
  | "confidence"
  | "quality_status"
  | "protocol_status"
  | "model_provider"
  | "model_version"
  | "classification_notes"
  | "dry_run"
  | "classification_source"
  | "processed_at"
>;

export type FiOsUnifiedClassifierOutcome =
  | { ok: true; result: FiOsUnifiedClassifierMappedResult; latencyMs: number; raw: UnifiedImageClassifyResponseWire }
  | { ok: false; reason: string; latencyMs?: number };

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampUnit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function resolveUnifiedClassifierUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const validation = validateFiOsClassifierConfig(env);
  if (!validation.valid) return null;
  return validation.config.url;
}

function truthyEnv(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function resolveFiOsUnifiedClassifierRequireHmac(env: NodeJS.ProcessEnv = process.env): boolean {
  return truthyEnv(env[FI_OS_IMAGE_CLASSIFIER_REQUIRE_HMAC_ENV]);
}

export function resolveFiOsUnifiedClassifierHmacSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env[FI_OS_IMAGE_CLASSIFIER_HMAC_SECRET_ENV]?.trim() ?? "";
  return secret.length > 0 ? secret : null;
}

export type FiOsUnifiedClassifierHmacConfig = {
  requireHmac: boolean;
  secret: string | null;
  shouldSign: boolean;
};

export function resolveFiOsUnifiedClassifierHmacConfig(
  env: NodeJS.ProcessEnv = process.env
): FiOsUnifiedClassifierHmacConfig {
  const requireHmac = resolveFiOsUnifiedClassifierRequireHmac(env);
  const secret = resolveFiOsUnifiedClassifierHmacSecret(env);
  return {
    requireHmac,
    secret,
    shouldSign: secret != null || requireHmac,
  };
}

export function buildFiOsUnifiedClassifierSignatureMaterial(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function computeFiOsUnifiedClassifierHmacHex(secret: string, material: string): string {
  return createHmac("sha256", secret).update(material, "utf8").digest("hex");
}

export function buildFiOsUnifiedClassifierRequestHeaders(input: {
  token: string;
  rawBody: string;
  hmacSecret?: string | null;
  requireHmac?: boolean;
  timestamp?: string;
}): Record<string, string> | { error: string } {
  const requireHmac = input.requireHmac ?? false;
  const hmacSecret = input.hmacSecret?.trim() ? input.hmacSecret.trim() : null;
  const shouldSign = hmacSecret != null || requireHmac;

  if (requireHmac && !hmacSecret) {
    return {
      error: `${FI_OS_IMAGE_CLASSIFIER_HMAC_SECRET_ENV} is required when ${FI_OS_IMAGE_CLASSIFIER_REQUIRE_HMAC_ENV}=true`,
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${input.token}`,
    [FI_OS_IMAGING_HDR_SOURCE_SYSTEM]: "hairaudit",
  };

  if (shouldSign && hmacSecret) {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const material = buildFiOsUnifiedClassifierSignatureMaterial(timestamp, input.rawBody);
    headers[FI_OS_IMAGING_HDR_TIMESTAMP] = timestamp;
    headers[FI_OS_IMAGING_HDR_SIGNATURE] = computeFiOsUnifiedClassifierHmacHex(hmacSecret, material);
  }

  return headers;
}

export function signFiOsUnifiedClassifierRequestForTests(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
}): { timestamp: string; signature: string } {
  const material = buildFiOsUnifiedClassifierSignatureMaterial(input.timestamp, input.rawBody);
  return {
    timestamp: input.timestamp,
    signature: computeFiOsUnifiedClassifierHmacHex(input.secret, material),
  };
}

export function buildUnifiedClassifierRequestBody(
  input: FiOsUnifiedClassifierInput
): Record<string, unknown> {
  return {
    source_system: "hairaudit",
    source_image_id: input.source_image_id,
    case_id: input.case_id,
    ...(input.patient_id ? { patient_id: input.patient_id } : {}),
    canonical_photo_category: input.canonical_photo_category,
    ...(input.legacy_upload_type ? { legacy_upload_type: input.legacy_upload_type } : {}),
    capture_source: input.capture_source ?? "forensic_audit",
    upload_source: input.upload_source ?? "hairaudit",
    ...(input.storage_bucket ? { storage_bucket: input.storage_bucket } : {}),
    ...(input.storage_path ? { storage_path: input.storage_path } : {}),
    ...(input.signed_url ? { signed_url: input.signed_url } : {}),
    ...(input.image_url ? { image_url: input.image_url } : {}),
    ...(input.image_content_type ? { image_content_type: input.image_content_type } : {}),
    ...(input.image_size_bytes != null ? { image_size_bytes: input.image_size_bytes } : {}),
    metadata: {
      idempotency_key: input.idempotency_key,
      ...(input.metadata ?? {}),
    },
  };
}

export function parseUnifiedImageClassifyResponse(
  body: unknown
): { classification: ImageClassificationResultV1Wire; fallback_used: boolean; provider: string; processing_version: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as UnifiedImageClassifyResponseWire;
  const classification = record.classification;
  if (!classification || typeof classification !== "object") return null;

  const category =
    readNonEmptyString(classification.category) ??
    readNonEmptyString((classification.metadata as Record<string, unknown> | undefined)?.category);

  if (!category && classification.confidence == null) return null;

  return {
    classification,
    fallback_used: record.fallback_used === true,
    provider: readNonEmptyString(record.provider) ?? "unknown",
    processing_version:
      readNonEmptyString(record.processing_version) ??
      readNonEmptyString(classification.metadata?.processing_version as string | undefined) ??
      "unknown",
  };
}

export function mapUnifiedClassificationToHairAuditResult(input: {
  parsed: ReturnType<typeof parseUnifiedImageClassifyResponse>;
  sourceUploadId: string;
  processedAt: string;
}): FiOsUnifiedClassifierMappedResult | null {
  if (!input.parsed) return null;
  const { classification, fallback_used, provider, processing_version } = input.parsed;

  const categoryRaw =
    readNonEmptyString(classification.category) ??
    readNonEmptyString(classification.metadata?.category as string | undefined) ??
    "other";

  const confidence = clampConfidence(classification.confidence);
  const qualityScore = clampUnit(classification.quality_score);
  const blurScore = clampUnit(classification.blur_score);
  const protocolCompliant = classification.protocol_compliant === true;

  return {
    classification_status: "classified",
    canonical_photo_category: mapFiCategoryToCanonical(categoryRaw),
    confidence,
    quality_status: qualityScore != null ? `score:${qualityScore.toFixed(3)}` : "not_evaluated",
    protocol_status: protocolCompliant ? "compliant" : fallback_used ? "degraded" : "not_evaluated",
    model_provider: "fi_os_unified",
    model_version: processing_version,
    classification_notes: fallback_used
      ? `unified classifier fallback (${provider})`
      : `classified via FI OS unified endpoint (${provider})`,
    dry_run: false,
    classification_source: "fi_os_unified",
    processed_at: input.processedAt,
  };
}

function clampConfidence(value: unknown): number | null {
  return clampUnit(value);
}

export function numericQualityFromResult(result: Pick<FiImageIntelligenceResult, "quality_status">): number | null {
  const match = /^score:([0-9.]+)$/.exec(result.quality_status);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function numericProtocolFromResult(result: Pick<FiImageIntelligenceResult, "protocol_status">): number | null {
  if (result.protocol_status === "compliant") return 1;
  if (result.protocol_status === "degraded" || result.protocol_status === "non_compliant") return 0;
  return null;
}

/**
 * POST to FI OS unified classifier and map ImageClassificationResultV1 → HairAudit result shape.
 */
export async function classifyWithFiOsUnifiedImageClassifier(
  input: FiOsUnifiedClassifierInput,
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: FiOsClassifierFetchImpl;
  } = {}
): Promise<FiOsUnifiedClassifierOutcome> {
  const env = options.env ?? process.env;
  const validation = validateFiOsClassifierConfig(env);

  if (!validation.valid) {
    const reason =
      validation.error === "url_missing" || validation.error === "token_missing"
        ? "FI OS unified image classifier not configured"
        : validation.message;
    return { ok: false, reason };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "FI OS unified classifier fetch is unavailable" };
  }

  const { url, token, timeoutMs } = validation.config;
  const hmacConfig = resolveFiOsUnifiedClassifierHmacConfig(env);
  const rawBody = JSON.stringify(buildUnifiedClassifierRequestBody(input));
  const headers = buildFiOsUnifiedClassifierRequestHeaders({
    token,
    rawBody,
    hmacSecret: hmacConfig.secret,
    requireHmac: hmacConfig.requireHmac,
  });

  if ("error" in headers) {
    return { ok: false, reason: headers.error };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: rawBody,
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        ok: false,
        reason: `FI OS unified classifier request failed (${response.status})`,
        latencyMs,
      };
    }

    let parsedBody: unknown;
    try {
      parsedBody = await response.json();
    } catch {
      return { ok: false, reason: "FI OS unified classifier returned invalid JSON", latencyMs };
    }

    const parsed = parseUnifiedImageClassifyResponse(parsedBody);
    const mapped = mapUnifiedClassificationToHairAuditResult({
      parsed,
      sourceUploadId: input.source_image_id,
      processedAt: input.processed_at ?? new Date().toISOString(),
    });

    if (!mapped) {
      return { ok: false, reason: "FI OS unified classifier returned an invalid response", latencyMs };
    }

    return {
      ok: true,
      result: mapped,
      latencyMs,
      raw: parsedBody as UnifiedImageClassifyResponseWire,
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const name = err instanceof Error ? err.name : "request-error";
    if (name === "AbortError") {
      return { ok: false, reason: "FI OS unified classifier request timed out", latencyMs };
    }
    return { ok: false, reason: "FI OS unified classifier request failed", latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

export { FI_OS_IMAGE_CLASSIFIER_URL_ENV, FI_OS_IMAGE_CLASSIFIER_TOKEN_ENV };
