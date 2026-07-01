/**
 * FI image-intelligence classifier adapter — Phase 3D scaffold, Phase 3E fi_os adapter,
 * FIN-IMAGING-3 unified cutover (legacy / shadow / fi_os).
 *
 * Provider switch for classification. Default is dry_run; manual_stub infers
 * category from canonical/legacy metadata only. fi_os_legacy calls the legacy FI
 * HTTP adapter. fi_os cutover mode uses POST /api/internal/imaging/classify.
 *
 * See: docs/hairaudit-v2-phase-3d-image-fetch-classifier-adapter.md
 *      docs/hairaudit-v2-phase-3e-fi-os-classifier-adapter.md
 *      docs/fin-imaging-3-hairaudit-staging-cutover.md
 */

import {
  classifyWithFiOsImageClassifier,
  FI_OS_IMAGE_CLASSIFIER_TOKEN_ENV,
  FI_OS_IMAGE_CLASSIFIER_URL_ENV,
  type FiOsClassifierFetchImpl,
} from "./fiOsImageClassifierClient";
import {
  classifyWithFiOsUnifiedImageClassifier,
  type FiOsUnifiedClassifierInput,
} from "@/lib/integrations/fiOsUnifiedImageClassifier";
import {
  resolveFiImageClassifierCutoverMode,
  resolveFiImageClassifierLegacyProvider,
  resolveLegacyProviderFromOption,
  type FiImageClassifierCutoverMode,
  type FiImageClassifierLegacyProvider,
  type FiImageClassifierProvider,
} from "./fiImageClassifierCutover";
import { runClassifierShadowComparison } from "./fiImageClassifierShadowCompare";
import { logClassifierCutoverEvent } from "./fiImageClassifierObservability";
import { resolveCanonicalCategoryForUploadEvent } from "./uploadEvents";
import type { FiImageFetchResult } from "./fiImageIntelligenceImageFetch";
import type { FiImageIntelligenceResult } from "./fiImageIntelligenceResult";
import { buildDryRunFiImageIntelligenceResult } from "./fiImageIntelligenceResult";

export type { FiImageClassifierProvider, FiImageClassifierCutoverMode, FiImageClassifierLegacyProvider };

const VALID_LEGACY_PROVIDERS = new Set<FiImageClassifierLegacyProvider>([
  "dry_run",
  "manual_stub",
  "fi_os_legacy",
  "openai",
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
  patient_id?: string;
  capture_source?: string;
  upload_source?: string;
  image_fetch?: FiImageFetchResult;
  processed_at?: string;
};

export type ClassifyHairAuditImageOptions = {
  /** Legacy inner provider override (Phase 3E tests). `fi_os` maps to fi_os_legacy. */
  provider?: FiImageClassifierProvider;
  /** FIN-IMAGING-3 cutover mode override. */
  cutoverMode?: FiImageClassifierCutoverMode;
  /** Injectable fetch for fi_os providers (legacy + unified). */
  fiOsFetchImpl?: FiOsClassifierFetchImpl;
  logger?: { info: (msg: string, meta?: Record<string, unknown>) => void; warn?: (msg: string, meta?: Record<string, unknown>) => void };
};

export type ClassifyHairAuditImageOutcome =
  | { ok: true; result: FiImageIntelligenceResult }
  | { ok: false; reason: string };

/** @deprecated Prefer resolveFiImageClassifierLegacyProvider — retained for Phase 3D/E callers. */
export function resolveFiImageClassifierProvider(
  env: NodeJS.ProcessEnv = process.env
): FiImageClassifierProvider {
  const legacy = resolveFiImageClassifierLegacyProvider(env);
  return legacy;
}

export function resolveFiImageClassifierCutoverModeFromEnv(
  env: NodeJS.ProcessEnv = process.env
): FiImageClassifierCutoverMode {
  return resolveFiImageClassifierCutoverMode(env);
}

export function isRealAiClassifierProvider(provider: FiImageClassifierLegacyProvider): boolean {
  return provider === "fi_os_legacy" || provider === "openai";
}

export function requiredEnvKeyForClassifierProvider(
  provider: FiImageClassifierLegacyProvider
): string | null {
  if (provider === "fi_os_legacy") return FI_OS_IMAGE_CLASSIFIER_URL_ENV;
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

function buildUnifiedInput(input: ClassifyHairAuditImageInput): FiOsUnifiedClassifierInput {
  return {
    source_image_id: input.source_upload_id,
    case_id: input.source_case_id,
    patient_id: input.patient_id,
    canonical_photo_category: input.canonical_photo_category,
    legacy_upload_type: input.legacy_upload_type,
    capture_source: input.capture_source,
    upload_source: input.upload_source,
    idempotency_key: input.idempotency_key,
    processed_at: input.processed_at,
    ...storageFieldsFromFetch(input.image_fetch),
  };
}

async function classifyWithFiOsLegacyProvider(
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

async function classifyWithUnifiedFiOsProvider(
  input: ClassifyHairAuditImageInput,
  fetchFields: Pick<
    FiImageIntelligenceResult,
    "image_fetch_status" | "image_content_type" | "image_size_bytes"
  >,
  fiOsFetchImpl?: FiOsClassifierFetchImpl
): Promise<ClassifyHairAuditImageOutcome> {
  const unifiedOutcome = await classifyWithFiOsUnifiedImageClassifier(buildUnifiedInput(input), {
    fetchImpl: fiOsFetchImpl,
  });

  if (!unifiedOutcome.ok) {
    return { ok: false, reason: unifiedOutcome.reason };
  }

  return {
    ok: true,
    result: {
      ...unifiedOutcome.result,
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

async function classifyWithLegacyInnerProvider(
  input: ClassifyHairAuditImageInput,
  legacyProvider: FiImageClassifierLegacyProvider,
  fetchFields: Pick<
    FiImageIntelligenceResult,
    "image_fetch_status" | "image_content_type" | "image_size_bytes"
  >,
  fiOsFetchImpl?: FiOsClassifierFetchImpl
): Promise<ClassifyHairAuditImageOutcome> {
  if (legacyProvider === "dry_run") {
    return { ok: true, result: buildDryRunAdapterResult(input, fetchFields) };
  }

  if (legacyProvider === "manual_stub") {
    return { ok: true, result: buildManualStubResult(input, fetchFields) };
  }

  if (legacyProvider === "fi_os_legacy") {
    return classifyWithFiOsLegacyProvider(input, fetchFields, fiOsFetchImpl);
  }

  if (legacyProvider === "openai") {
    return { ok: false, reason: "openai classification is not implemented (Phase 3F+)" };
  }

  return { ok: false, reason: "unknown classifier provider" };
}

/**
 * Classify a HairAudit upload image using cutover mode + legacy/unified providers.
 */
export async function classifyHairAuditImage(
  input: ClassifyHairAuditImageInput,
  options: ClassifyHairAuditImageOptions = {}
): Promise<ClassifyHairAuditImageOutcome> {
  const cutoverMode = options.cutoverMode ?? resolveFiImageClassifierCutoverMode();
  const legacyProvider = resolveLegacyProviderFromOption(options.provider);
  const fetchFields = imageFetchFields(input.image_fetch);
  const legacyStartedAt = Date.now();

  if (cutoverMode === "fi_os") {
    const outcome = await classifyWithUnifiedFiOsProvider(input, fetchFields, options.fiOsFetchImpl);
    logClassifierCutoverEvent(options.logger, {
      cutover_mode: "fi_os",
      upload_id: input.source_upload_id,
      case_id: input.source_case_id,
      ok: outcome.ok,
      provider: outcome.ok ? outcome.result.classification_source : undefined,
      latency_ms: Date.now() - legacyStartedAt,
    });
    return outcome;
  }

  const legacyOutcome = await classifyWithLegacyInnerProvider(
    input,
    legacyProvider,
    fetchFields,
    options.fiOsFetchImpl
  );

  if (cutoverMode !== "shadow") {
    return legacyOutcome;
  }

  if (!legacyOutcome.ok) {
    logClassifierCutoverEvent(options.logger, {
      cutover_mode: "shadow",
      upload_id: input.source_upload_id,
      case_id: input.source_case_id,
      ok: false,
      legacy_error: legacyOutcome.reason,
    });
    return legacyOutcome;
  }

  const legacyLatencyMs = Date.now() - legacyStartedAt;

  try {
    await runClassifierShadowComparison(
      {
        ...buildUnifiedInput(input),
        upload_id: input.source_upload_id,
        legacy_result: legacyOutcome.result,
        legacy_latency_ms: legacyLatencyMs,
      },
      { fetchImpl: options.fiOsFetchImpl, logger: options.logger }
    );
  } catch {
    // shadow compare must never block legacy authoritative path
  }

  return legacyOutcome;
}

export function workerStatusForClassification(
  result: FiImageIntelligenceResult
): "dry_run" | "classified" {
  return result.classification_status === "classified" ? "classified" : "dry_run";
}

export function isLegacyClassifierProviderValue(value: string): value is FiImageClassifierLegacyProvider {
  return VALID_LEGACY_PROVIDERS.has(value as FiImageClassifierLegacyProvider);
}
