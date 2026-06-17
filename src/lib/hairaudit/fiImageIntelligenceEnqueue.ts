/**
 * FI image-intelligence enqueue orchestration — Phase 3A
 *
 * Evaluates upload events and enqueues durable jobs when eligible.
 * Never throws to upload routes.
 *
 * See: docs/hairaudit-v2-phase-3a-fi-image-intelligence-enqueue.md
 */

import {
  evaluateFiImageIntelligenceEnqueue,
  type FiImageIntelligenceBridgeResult,
} from "./fiImageIntelligenceBridge";
import {
  buildFiImageIntelligenceIdempotencyKey,
  getFiImageIntelligenceQueue,
  type FiImageIntelligenceEnqueueSummary,
} from "./fiImageIntelligenceQueue";
import {
  HAIRAUDIT_UPLOAD_EVENT_NAMES,
  type HairAuditUploadEvent,
} from "./uploadEvents";

export type FiImageIntelligenceEnqueuePlan = FiImageIntelligenceBridgeResult & {
  idempotency_key?: string;
};

/**
 * Pure evaluation + idempotency key for tests and diagnostics.
 * Does not perform queue I/O.
 */
export function planFiImageIntelligenceEnqueue(
  event: HairAuditUploadEvent
): FiImageIntelligenceEnqueuePlan {
  const evaluation = evaluateFiImageIntelligenceEnqueue(event);
  if (!evaluation.should_enqueue_image_intelligence) {
    return evaluation;
  }

  return {
    ...evaluation,
    idempotency_key: buildFiImageIntelligenceIdempotencyKey(
      evaluation.input.source_case_id,
      evaluation.input.source_upload_id
    ),
  };
}

/**
 * Evaluate and enqueue when eligible. Swallows errors — never throws to callers.
 */
export async function maybeEnqueueFiImageIntelligenceFromUploadEvent(
  event: HairAuditUploadEvent
): Promise<FiImageIntelligenceEnqueueSummary> {
  if (event.event_name !== HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED) {
    return {
      enqueued: false,
      skippedReason: "only upload.created events are enqueue candidates",
    };
  }

  const plan = planFiImageIntelligenceEnqueue(event);
  if (!plan.should_enqueue_image_intelligence || !plan.idempotency_key) {
    return {
      enqueued: false,
      skippedReason: plan.reason ?? "not eligible for FI image intelligence enqueue",
    };
  }

  try {
    const queue = getFiImageIntelligenceQueue();
    return await queue.enqueue({
      idempotency_key: plan.idempotency_key,
      input: plan.input,
      enqueued_at: new Date().toISOString(),
    });
  } catch {
    return {
      enqueued: false,
      idempotency_key: plan.idempotency_key,
      error: "unexpected enqueue failure",
    };
  }
}

/**
 * Fire-and-forget enqueue hook for upload routes. Never throws or blocks upload success.
 */
export function enqueueFiImageIntelligenceFromUploadEvent(event: HairAuditUploadEvent): void {
  void maybeEnqueueFiImageIntelligenceFromUploadEvent(event).catch(() => {
    /* never propagate */
  });
}
