/**
 * Phase 3B — Inngest worker for FI image-intelligence jobs.
 *
 * REGRESSION GUARDS:
 * - Do NOT call OpenAI, Claude, Gemini, or runAIAudit.
 * - Do NOT fetch image bytes from storage (metadata validation only).
 * - Do NOT mutate upload routes, RLS, or storage paths.
 */
import { inngest } from "@/lib/inngest/client";
import {
  FI_IMAGE_INTELLIGENCE_INNGEST_EVENT,
  type FiImageIntelligenceJobPayload,
} from "@/lib/hairaudit/fiImageIntelligenceQueue";
import { processFiImageIntelligenceJob } from "@/lib/hairaudit/fiImageIntelligenceWorker";

export const runFiImageIntelligenceWorker = inngest.createFunction(
  {
    id: "fi-image-intelligence-v1",
    retries: 2,
    concurrency: { key: "event.data.input.source_upload_id", limit: 5 },
  },
  { event: FI_IMAGE_INTELLIGENCE_INNGEST_EVENT },
  async ({ event, step, logger }) => {
    const data = event.data as FiImageIntelligenceJobPayload;

    const outcome = await step.run("process-fi-image-intelligence", async () => {
      return processFiImageIntelligenceJob(data);
    });

    if (outcome.status === "failed") {
      logger.warn("FI image-intelligence worker failed", {
        reason: outcome.reason,
        idempotency_key: outcome.idempotency_key,
        case_id: data.input?.source_case_id,
        upload_id: data.input?.source_upload_id,
      });
    } else if (outcome.status === "skipped") {
      logger.info("FI image-intelligence worker skipped", {
        reason: outcome.reason,
        idempotency_key: outcome.idempotency_key,
      });
    } else {
      logger.info("FI image-intelligence worker dry-run complete", {
        idempotency_key: outcome.idempotency_key,
        case_id: data.input?.source_case_id,
        upload_id: data.input?.source_upload_id,
        dry_run: outcome.result?.dry_run,
      });
    }

    return { ok: outcome.status !== "failed", ...outcome };
  }
);
