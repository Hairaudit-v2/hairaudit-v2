/**
 * FI image-intelligence classifier adapter — Phase 3D scaffold, Phase 3E fi_os adapter
 *
 * Provider switch for classification. Default is dry_run; manual_stub infers
 * category from canonical/legacy metadata only. fi_os calls the internal FI
 * HTTP adapter when configured. No direct OpenAI / Claude / Gemini calls.
 *
 * See: docs/hairaudit-v2-phase-3d-image-fetch-classifier-adapter.md
 *      docs/hairaudit-v2-phase-3e-fi-os-classifier-adapter.md
 */

import {
  classifyWithFiOsImageClassifier,
  FI_OS_IMAGE_CLASSIFIER_TOKEN_ENV,
  FI_OS_IMAGE_CLASSIFIER_URL_ENV,
  type FiOsClassifierFetchImpl,
} from "./fiOsImageClassifierClient";
import { resolveCanonicalCategoryForUploadEvent } from "./uploadEvents";
import type { FiImageFetchResult } from "./fiImageIntelligenceImageFetch";
import type { FiImageIntelligenceResult } from "./fiImageIntelligenceResult";
import { buildDryRunFiImageIntelligenceResult } from "./fiImageIntelligenceResult";

export type FiImageClassifierProvider = "dry_run" | "fi_os" | "openai" | "manual_stub";

const VALID_PROVIDERS = new Set<FiImageClassifierProvider>([
  "dry_run",
  "fi_os",
  "openai",
  "manual_stub",
]);

/** Primary env var for fi_os provider readiness (URL also required). */
export const FI_OS_CLASSIFIER_ENV_KEY = FI_OS_IMAGE_CLASSIFIER_URL_ENV;

export { FI_OS_IMAGE_CLASSIFIER_URL_ENV, FI_OS_IMAGE_CLASSIFIER_TOKEN_ENV };

/** Env var required when provider is openai (readiness only — not implemented in 3D). */
export const OPENAI_CLASSIFIER_ENV_KEY = "OPENAI_API_KEY" as const;

export type ClassifyHairAuditImageInput = {
  idempotency_key: string;
  source_case_id: string;
  source_upload_id: string;
  canonical_photo_category: string;
  legacy_upload_type?: string;
  image_fetch?: FiImageFetchResult;
  processed_at?: string;
};

export type ClassifyHairAuditImageOptions = {
  provider?: FiImageClassifierProvider;
  /** Injectable fetch for fi_os provider tests. */
  fiOsFetchImpl?: FiOsClassifierFetchImpl;
};

export type ClassifyHairAuditImageOutcome =
  | { ok: true; result: FiImageIntelligenceResult }
  | { ok: false; reason: string };

export function resolveFiImageClassifierProvider(
  env: NodeJS.ProcessEnv = process.env
): FiImageClassifierProvider {
  const raw = env.HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER?.trim().toLowerCase();
  if (raw && VALID_PROVIDERS.has(raw as FiImageClassifierProvider)) {
    return raw as FiImageClassifierProvider;
  }
  return "dry_run";
}

export function isRealAiClassifierProvider(provider: FiImageClassifierProvider): boolean {
  return provider === "fi_os" || provider === "openai";
}

export function requiredEnvKeyForClassifierProvider(
  provider: FiImageClassifierProvider
): string | null {
  if (provider === "fi_os") return FI_OS_IMAGE_CLASSIFIER_URL_ENV;
  if (provider === "openai") return OPENAI_CLASSIFIER_ENV_KEY;
  return null;
}

function storageFieldsFromFetch(
  imageFetch?: FiImageFetchResult
): { storage_bucket?: string; storage_path?: string; image_content_type?: string | null; image_size_bytes?: number | null } {
  if (!imageFetch || imageFetch.status !== "ok") {
    return {};
  }
  return {
    storage_bucket: imageFetch.bucket,
    storage_path: imageFetch.normalized_path,
    image_content_type: imageFetch.content_type,
    image_size_bytes: imageFetch.size_bytes,
  };
}

async function classifyWithFiOsProvider(
  input: ClassifyHairAuditImageInput,
  fetchFields: Pick<
    FiImageIntelligenceResult,
    "image_fetch_status" | "image_content_type" | "image_size_bytes"
  >,
  fiOsFetchImpl?: FiOsClassifierFetchImpl
): Promise<ClassifyHairAuditImageOutcome> {
  const fiOutcome = await classifyWithFiOsImageClassifier(
    {
      idempotency_key: input.idempotency_key,
      source_case_id: input.source_case_id,
      source_upload_id: input.source_upload_id,
      canonical_photo_category: input.canonical_photo_category,
      legacy_upload_type: input.legacy_upload_type,
      processed_at: input.processed_at,
      ...storageFieldsFromFetch(input.image_fetch),
    },
    { fetchImpl: fiOsFetchImpl }
  );

  if (!fiOutcome.ok) {
    return { ok: false, reason: fiOutcome.reason };
  }

  return {
    ok: true,
    result: {
      ...fiOutcome.result,
      idempotency_key: input.idempotency_key,
      source_case_id: input.source_case_id,
      source_upload_id: input.source_upload_id,
      ...fetchFields,
    },
  };
}

function imageFetchFields(imageFetch?: FiImageFetchResult): Pick<
  FiImageIntelligenceResult,
  "image_fetch_status" | "image_content_type" | "image_size_bytes"
> {
  if (!imageFetch) {
    return {
      image_fetch_status: "skipped",
      image_content_type: null,
      image_size_bytes: null,
    };
  }

  if (imageFetch.status === "ok") {
    return {
      image_fetch_status: "ok",
      image_content_type: imageFetch.content_type,
      image_size_bytes: imageFetch.size_bytes,
    };
  }

  return {
    image_fetch_status: imageFetch.status,
    image_content_type: null,
    image_size_bytes: null,
  };
}

/** Deterministic confidence from category string — no AI. */
export function manualStubConfidenceForCategory(category: string): number {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  return 0.7 + (hash % 26) / 100;
}

function resolveManualStubCategory(input: ClassifyHairAuditImageInput): string {
  const fromCanonical = resolveCanonicalCategoryForUploadEvent({
    explicit_category: input.canonical_photo_category,
  });
  if (fromCanonical !== "other") {
    return fromCanonical;
  }

  const fromLegacy = resolveCanonicalCategoryForUploadEvent({
    legacy_upload_type: input.legacy_upload_type,
  });
  if (fromLegacy !== "other") {
    return fromLegacy;
  }

  return fromCanonical;
}

function buildManualStubResult(
  input: ClassifyHairAuditImageInput,
  fetchFields: Pick<
    FiImageIntelligenceResult,
    "image_fetch_status" | "image_content_type" | "image_size_bytes"
  >
): FiImageIntelligenceResult {
  const resolvedCategory = resolveManualStubCategory(input);

  const confidence = manualStubConfidenceForCategory(resolvedCategory);
  const processedAt = input.processed_at ?? new Date().toISOString();

  return {
    classification_status: "classified",
    canonical_photo_category: resolvedCategory,
    confidence,
    quality_status: "not_evaluated",
    protocol_status: "not_evaluated",
    model_provider: "manual_stub",
    model_version: "phase-3d-stub",
    processed_at: processedAt,
    dry_run: false,
    idempotency_key: input.idempotency_key,
    source_case_id: input.source_case_id,
    source_upload_id: input.source_upload_id,
    classification_source: "manual_stub",
    classification_notes: input.legacy_upload_type
      ? "category inferred from canonical and legacy metadata (no AI)"
      : "category inferred from canonical metadata (no AI)",
    ...fetchFields,
  };
}

function buildDryRunAdapterResult(
  input: ClassifyHairAuditImageInput,
  fetchFields: Pick<
    FiImageIntelligenceResult,
    "image_fetch_status" | "image_content_type" | "image_size_bytes"
  >
): FiImageIntelligenceResult {
  const base = buildDryRunFiImageIntelligenceResult({
    idempotency_key: input.idempotency_key,
    source_case_id: input.source_case_id,
    source_upload_id: input.source_upload_id,
    canonical_photo_category: input.canonical_photo_category,
    processed_at: input.processed_at,
  });

  return {
    ...base,
    ...fetchFields,
    classification_source: "dry_run",
    classification_notes: "worker enabled — dry-run placeholder (AI execution deferred)",
  };
}

/**
 * Classify a HairAudit upload image using the configured provider.
 * fi_os uses the internal FI HTTP adapter when configured; openai remains deferred.
 */
export async function classifyHairAuditImage(
  input: ClassifyHairAuditImageInput,
  options: ClassifyHairAuditImageOptions = {}
): Promise<ClassifyHairAuditImageOutcome> {
  const provider = options.provider ?? resolveFiImageClassifierProvider();
  const fetchFields = imageFetchFields(input.image_fetch);

  if (provider === "dry_run") {
    return {
      ok: true,
      result: buildDryRunAdapterResult(input, fetchFields),
    };
  }

  if (provider === "manual_stub") {
    return {
      ok: true,
      result: buildManualStubResult(input, fetchFields),
    };
  }

  if (provider === "fi_os") {
    return classifyWithFiOsProvider(input, fetchFields, options.fiOsFetchImpl);
  }

  if (provider === "openai") {
    return {
      ok: false,
      reason: "openai classification is not implemented (Phase 3F+)",
    };
  }

  return { ok: false, reason: "unknown classifier provider" };
}

export function workerStatusForClassification(
  result: FiImageIntelligenceResult
): "dry_run" | "classified" {
  return result.classification_status === "classified" ? "classified" : "dry_run";
}
