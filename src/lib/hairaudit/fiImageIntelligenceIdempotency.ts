/**
 * FI image-intelligence idempotency helpers — Phase 3B scaffold, Phase 3C DB persistence
 *
 * Pure processed-key decision helper for in-memory tests. Production worker uses
 * `fiImageIntelligencePersistence.ts` (table: fi_image_intelligence_processed_jobs).
 *
 * See: docs/hairaudit-v2-phase-3b-fi-image-intelligence-worker-scaffold.md
 *      docs/hairaudit-v2-phase-3c-image-intelligence-persistence.md
 */

export type FiImageIntelligenceProcessedKeyDecision =
  | { action: "process"; reason: "idempotency_key not yet processed" }
  | { action: "skip"; reason: string };

/**
 * Decide whether a job should run given a set/map of already-processed keys.
 * Inject `processedKeys` from an in-memory test double today; from DB in Phase 3C+.
 */
export function decideFiImageIntelligenceProcessedKey(
  idempotencyKey: string,
  processedKeys: ReadonlySet<string> | ReadonlyMap<string, unknown>
): FiImageIntelligenceProcessedKeyDecision {
  const key = idempotencyKey.trim();
  if (!key) {
    return { action: "skip", reason: "empty idempotency_key" };
  }

  const alreadyProcessed =
    processedKeys instanceof Map ? processedKeys.has(key) : processedKeys.has(key);

  if (alreadyProcessed) {
    return {
      action: "skip",
      reason: `idempotency_key already processed: ${key}`,
    };
  }

  return { action: "process", reason: "idempotency_key not yet processed" };
}

/** Test/diagnostic helper — mark a key as processed in an in-memory set. */
export function markFiImageIntelligenceKeyProcessed(
  processedKeys: Set<string>,
  idempotencyKey: string
): void {
  processedKeys.add(idempotencyKey.trim());
}
