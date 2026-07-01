/**
 * FIN-IMAGING-3 — dual classification shadow compare (legacy authoritative).
 */

import type { FiImageIntelligenceResult } from "./fiImageIntelligenceResult";
import {
  classifyWithFiOsUnifiedImageClassifier,
  numericProtocolFromResult,
  numericQualityFromResult,
  type FiOsUnifiedClassifierInput,
} from "@/lib/integrations/fiOsUnifiedImageClassifier";
import type { FiOsClassifierFetchImpl } from "./fiOsImageClassifierClient";
import {
  logClassifierShadowComparison,
  type ClassifierShadowComparisonLogPayload,
} from "./fiImageClassifierObservability";
import {
  insertClassifierShadowComparison,
  type ClassifierShadowComparisonRecord,
} from "./fiImageClassifierShadowPersistence";

export type ShadowComparisonInput = FiOsUnifiedClassifierInput & {
  upload_id: string;
  legacy_result: FiImageIntelligenceResult;
  legacy_latency_ms: number;
};

export type ShadowComparisonOutcome = {
  recorded: boolean;
  comparison?: ClassifierShadowComparisonRecord;
  unified_error?: string;
};

function categoryMatch(legacy: FiImageIntelligenceResult, unifiedCategory: string): boolean {
  return legacy.canonical_photo_category.trim().toLowerCase() === unifiedCategory.trim().toLowerCase();
}

function confidenceDelta(legacy: FiImageIntelligenceResult, unifiedConfidence: number | null): number | null {
  if (legacy.confidence == null || unifiedConfidence == null) return null;
  return unifiedConfidence - legacy.confidence;
}

export function buildShadowComparisonRecord(input: {
  upload_id: string;
  case_id: string;
  legacy: FiImageIntelligenceResult;
  unifiedCategory: string;
  unifiedConfidence: number | null;
  unifiedQualityScore: number | null;
  unifiedBlurScore: number | null;
  unifiedProtocolCompliant: boolean | null;
  unifiedFallbackUsed: boolean;
  unifiedProvider: string;
  processingVersion: string;
  legacyLatencyMs: number;
  unifiedLatencyMs: number;
}): Omit<ClassifierShadowComparisonRecord, "id" | "created_at"> {
  const legacyQuality = numericQualityFromResult(input.legacy);
  const legacyProtocol = numericProtocolFromResult(input.legacy);

  const qualityDelta =
    input.unifiedQualityScore != null && legacyQuality != null
      ? input.unifiedQualityScore - legacyQuality
      : null;

  const protocolDelta =
    input.unifiedProtocolCompliant != null && legacyProtocol != null
      ? (input.unifiedProtocolCompliant ? 1 : 0) - legacyProtocol
      : null;

  const blurDelta = input.unifiedBlurScore;

  return {
    upload_id: input.upload_id,
    case_id: input.case_id,
    legacy_category: input.legacy.canonical_photo_category,
    unified_category: input.unifiedCategory,
    categories_match: categoryMatch(input.legacy, input.unifiedCategory),
    confidence_delta: confidenceDelta(input.legacy, input.unifiedConfidence),
    quality_delta: qualityDelta,
    blur_delta: blurDelta,
    protocol_delta: protocolDelta,
    latency_ms: input.unifiedLatencyMs,
    unified_fallback_used: input.unifiedFallbackUsed,
    provider: input.unifiedProvider,
    processing_version: input.processingVersion,
    legacy_latency_ms: input.legacyLatencyMs,
    legacy_provider: input.legacy.classification_source,
  };
}

/**
 * Run unified classifier silently, persist comparison, never throw.
 */
export async function runClassifierShadowComparison(
  input: ShadowComparisonInput,
  options: {
    fetchImpl?: FiOsClassifierFetchImpl;
    logger?: { info: (msg: string, meta?: Record<string, unknown>) => void; warn?: (msg: string, meta?: Record<string, unknown>) => void };
  } = {}
): Promise<ShadowComparisonOutcome> {
  const unifiedStartedAt = Date.now();
  const unifiedOutcome = await classifyWithFiOsUnifiedImageClassifier(input, {
    fetchImpl: options.fetchImpl,
  });
  const unifiedLatencyMs = unifiedOutcome.latencyMs ?? Date.now() - unifiedStartedAt;

  if (!unifiedOutcome.ok) {
    const logPayload: ClassifierShadowComparisonLogPayload = {
      source_system: "hairaudit",
      upload_id: input.upload_id,
      case_id: input.case_id,
      cutover_mode: "shadow",
      outcome: "unified_failed",
      unified_error: unifiedOutcome.reason,
      legacy_category: input.legacy_result.canonical_photo_category,
      legacy_latency_ms: input.legacy_latency_ms,
      unified_latency_ms: unifiedLatencyMs,
    };
    logClassifierShadowComparison(options.logger, logPayload);
    return { recorded: false, unified_error: unifiedOutcome.reason };
  }

  const classification = unifiedOutcome.raw.classification;
  const unifiedCategory = unifiedOutcome.result.canonical_photo_category;
  const unifiedConfidence = unifiedOutcome.result.confidence;
  const unifiedQuality =
    typeof classification?.quality_score === "number" ? classification.quality_score : null;
  const unifiedBlur =
    typeof classification?.blur_score === "number" ? classification.blur_score : null;
  const unifiedProtocol =
    typeof classification?.protocol_compliant === "boolean"
      ? classification.protocol_compliant
      : null;

  const recordInput = buildShadowComparisonRecord({
    upload_id: input.upload_id,
    case_id: input.case_id,
    legacy: input.legacy_result,
    unifiedCategory,
    unifiedConfidence,
    unifiedQualityScore: unifiedQuality,
    unifiedBlurScore: unifiedBlur,
    unifiedProtocolCompliant: unifiedProtocol,
    unifiedFallbackUsed: unifiedOutcome.raw.fallback_used === true,
    unifiedProvider: unifiedOutcome.raw.provider ?? unifiedOutcome.result.model_provider ?? "unknown",
    processingVersion: unifiedOutcome.result.model_version ?? "unknown",
    legacyLatencyMs: input.legacy_latency_ms,
    unifiedLatencyMs,
  });

  const insertResult = await insertClassifierShadowComparison(recordInput);

  const logPayload: ClassifierShadowComparisonLogPayload = {
    source_system: "hairaudit",
    upload_id: input.upload_id,
    case_id: input.case_id,
    cutover_mode: "shadow",
    outcome: insertResult.ok ? "compared" : "persist_failed",
    categories_match: recordInput.categories_match,
    confidence_delta: recordInput.confidence_delta,
    quality_delta: recordInput.quality_delta,
    legacy_category: recordInput.legacy_category,
    unified_category: recordInput.unified_category,
    unified_fallback_used: recordInput.unified_fallback_used,
    legacy_latency_ms: input.legacy_latency_ms,
    unified_latency_ms: unifiedLatencyMs,
    provider: recordInput.provider,
  };
  logClassifierShadowComparison(options.logger, logPayload);

  return {
    recorded: insertResult.ok,
    comparison: insertResult.record,
    unified_error: insertResult.ok ? undefined : insertResult.error,
  };
}
