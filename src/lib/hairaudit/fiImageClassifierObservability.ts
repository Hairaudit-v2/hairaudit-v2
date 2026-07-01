/**
 * FIN-IMAGING-3 — structured observability for HairAudit classifier cutover.
 */

export type ClassifierShadowComparisonLogPayload = {
  source_system: "hairaudit";
  upload_id: string;
  case_id: string;
  cutover_mode: "legacy" | "shadow" | "fi_os";
  outcome:
    | "compared"
    | "unified_failed"
    | "persist_failed"
    | "legacy_failed"
    | "classified";
  categories_match?: boolean;
  confidence_delta?: number | null;
  quality_delta?: number | null;
  legacy_category?: string;
  unified_category?: string;
  unified_fallback_used?: boolean;
  legacy_latency_ms?: number;
  unified_latency_ms?: number;
  provider?: string;
  unified_error?: string;
  null_classification?: boolean;
  unsupported_category?: boolean;
};

const LOG_PREFIX = "[hairaudit:fi-classifier-cutover]";

export function logClassifierShadowComparison(
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void; warn?: (msg: string, meta?: Record<string, unknown>) => void } | undefined,
  payload: ClassifierShadowComparisonLogPayload
): void {
  const line = `${LOG_PREFIX} shadow_comparison`;
  if (logger) {
    if (payload.outcome === "unified_failed" || payload.outcome === "persist_failed") {
      logger.warn?.(line, payload as unknown as Record<string, unknown>) ??
        logger.info(line, payload as unknown as Record<string, unknown>);
    } else {
      logger.info(line, payload as unknown as Record<string, unknown>);
    }
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(line, payload);
  }
}

export function logClassifierCutoverEvent(
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void } | undefined,
  payload: Record<string, unknown>
): void {
  const line = `${LOG_PREFIX} cutover_event`;
  if (logger) {
    logger.info(line, payload);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(line, payload);
  }
}

export function isAlertWorthyShadowMismatch(payload: ClassifierShadowComparisonLogPayload): boolean {
  return payload.outcome === "compared" && payload.categories_match === false;
}

export function isAlertWorthyFallbackRate(fallbackUsed: boolean): boolean {
  return fallbackUsed;
}
