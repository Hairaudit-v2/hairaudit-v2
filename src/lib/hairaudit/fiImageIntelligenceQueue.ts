/**
 * FI image-intelligence job queue — Phase 3A
 *
 * Injectable enqueue adapter. Default: no-op. Inngest when flag enabled and configured.
 * No AI execution — orchestration only.
 *
 * See: docs/hairaudit-v2-phase-3a-fi-image-intelligence-enqueue.md
 */

import type { FiImageIntelligenceInput } from "./fiImageIntelligenceBridge";
import { isFiImageIntelligenceEnabled } from "./fiImageIntelligenceBridge";

const LOG_PREFIX = "[hairaudit:fi-image-intelligence-queue]";

/** Stable idempotency version — bump only when job payload contract changes. */
export const FI_IMAGE_INTELLIGENCE_IDEMPOTENCY_VERSION = "v1" as const;

/** Inngest event name for queued FI image-intelligence jobs (worker in Phase 3B). */
export const FI_IMAGE_INTELLIGENCE_INNGEST_EVENT = "hairaudit/fi.image-intelligence.enqueue" as const;

export type FiImageIntelligenceJobPayload = {
  idempotency_key: string;
  input: FiImageIntelligenceInput;
  enqueued_at: string;
};

export type FiImageIntelligenceEnqueueSummary = {
  enqueued: boolean;
  idempotency_key?: string;
  skippedReason?: string;
  error?: string;
};

export interface FiImageIntelligenceQueueAdapter {
  enqueue(payload: FiImageIntelligenceJobPayload): Promise<FiImageIntelligenceEnqueueSummary>;
}

/**
 * Idempotency key for one upload → one FI image-intelligence job.
 * Format: hairaudit:image-intelligence:{case_id}:{upload_id}:v1
 */
export function buildFiImageIntelligenceIdempotencyKey(
  caseId: string,
  uploadId: string
): string {
  return `hairaudit:image-intelligence:${caseId.trim()}:${uploadId.trim()}:${FI_IMAGE_INTELLIGENCE_IDEMPOTENCY_VERSION}`;
}

const noopQueue: FiImageIntelligenceQueueAdapter = {
  async enqueue(payload) {
    return {
      enqueued: false,
      idempotency_key: payload.idempotency_key,
      skippedReason: "fi-image-intelligence-queue-disabled",
    };
  },
};

const inngestQueue: FiImageIntelligenceQueueAdapter = {
  async enqueue(payload) {
    const eventKey = process.env?.INNGEST_EVENT_KEY?.trim();
    if (!eventKey) {
      if (process.env?.NODE_ENV !== "production") {
        console.warn(LOG_PREFIX, "skip enqueue — INNGEST_EVENT_KEY not configured");
      }
      return {
        enqueued: false,
        idempotency_key: payload.idempotency_key,
        skippedReason: "inngest-event-key-not-configured",
      };
    }

    try {
      const { inngest } = await import("@/lib/inngest/client");
      await inngest.send({
        name: FI_IMAGE_INTELLIGENCE_INNGEST_EVENT,
        data: payload,
        id: payload.idempotency_key,
      });
      return {
        enqueued: true,
        idempotency_key: payload.idempotency_key,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(LOG_PREFIX, "enqueue failed", {
        idempotency_key: payload.idempotency_key,
        case_id: payload.input.source_case_id,
        upload_id: payload.input.source_upload_id,
        message,
      });
      return {
        enqueued: false,
        idempotency_key: payload.idempotency_key,
        error: message,
      };
    }
  },
};

let injectedQueue: FiImageIntelligenceQueueAdapter | null = null;

export function getFiImageIntelligenceQueue(): FiImageIntelligenceQueueAdapter {
  if (injectedQueue) return injectedQueue;
  if (!isFiImageIntelligenceEnabled()) return noopQueue;
  return inngestQueue;
}

export function setFiImageIntelligenceQueue(queue: FiImageIntelligenceQueueAdapter): void {
  injectedQueue = queue;
}

/** Clear test injection so getFiImageIntelligenceQueue() rebuilds from environment. */
export function resetFiImageIntelligenceQueueInjection(): void {
  injectedQueue = null;
}
