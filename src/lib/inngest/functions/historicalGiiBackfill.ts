import { inngest } from "../client";
import { queueAuditorRerun } from "@/lib/auditor/queueAuditorRerun";

const MAX_CASES_PER_RUN = 100;
const RATE_DELAY_MS = 500;

/**
 * Sequential GII reruns for historical backfill (one `auditor/rerun` per case, rate-limited).
 * Triggered only via guarded POST /api/internal/gii-historical-backfill (or direct Inngest send with same payload shape).
 */
export const historicalGiiBackfillWorkflow = inngest.createFunction(
  {
    id: "historical-gii-backfill",
    retries: 0,
    concurrency: { limit: 1 },
  },
  { event: "internal/gii-historical-backfill" },
  async ({ event, step, logger }) => {
    const data = event.data as { caseIds?: unknown; triggeredBy?: string };
    const triggeredBy = String(data.triggeredBy ?? "").trim();
    if (!triggeredBy) {
      throw new Error("internal/gii-historical-backfill: missing triggeredBy");
    }

    const raw = data.caseIds;
    const caseIds = Array.isArray(raw)
      ? raw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, MAX_CASES_PER_RUN)
      : [];

    if (caseIds.length === 0) {
      logger.info("historical GII backfill: empty caseIds");
      return { ok: true, processed: 0, results: [] as const };
    }

    const results: Array<{ caseId: string; ok: boolean; error?: string; rerunLogId?: string }> = [];

    for (let i = 0; i < caseIds.length; i++) {
      const caseId = caseIds[i];
      const r = await step.run(`gii-historical-${i}-${caseId.slice(0, 8)}`, async () => {
        return queueAuditorRerun({
          caseId,
          actingUserId: triggeredBy,
          action: "regenerate_graft_integrity",
          reason: "auditor_review_request",
          notes: "GII historical backfill (Inngest workflow internal/gii-historical-backfill)",
        });
      });

      if (r.ok) {
        results.push({ caseId, ok: true, rerunLogId: r.rerunLogId });
      } else {
        results.push({ caseId, ok: false, error: r.error });
        logger.warn("historical GII backfill case failed", { caseId, error: r.error, httpStatus: r.httpStatus });
      }

      if (i < caseIds.length - 1) {
        await step.sleep(`gii-historical-delay-${i}`, `${RATE_DELAY_MS}ms`);
      }
    }

    return { ok: true, processed: results.length, results };
  }
);
