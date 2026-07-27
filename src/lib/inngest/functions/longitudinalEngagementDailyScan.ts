/**
 * FI-OUTCOME-INTELLIGENCE-1D — Daily batch engagement evaluator (Inngest).
 *
 * Idempotent, paginated, aggregate logs only (no PHI).
 * Creates channel-neutral events; does not send SMS/email/push from core.
 *
 * Delivery adapters are deferred — events remain pending until a channel
 * adapter is wired and FI_LONGITUDINAL_* channel flags are enabled.
 */

import { inngest } from "@/lib/inngest/client";
import { resolveLongitudinalEngagementConfig } from "@/lib/outcomeIntelligence/longitudinalEngagementConfig";

export const longitudinalEngagementDailyScan = inngest.createFunction(
  {
    id: "longitudinal-engagement-daily-scan",
    retries: 1,
    concurrency: { limit: 1 },
  },
  { cron: "0 12 * * *" },
  async ({ step, logger }) => {
    const config = resolveLongitudinalEngagementConfig();

    if (!config.enabled) {
      logger.info("longitudinal engagement scan skipped: feature disabled", {
        evaluated: 0,
        created: 0,
        suppressed: 0,
        delivered: 0,
        failed: 0,
      });
      return {
        ok: true,
        skipped: true,
        reason: "FI_LONGITUDINAL_ENGAGEMENT_ENABLED is not true",
      };
    }

    const summary = await step.run("scan-batch", async () => {
      // Capture-plan pagination + hydrate + decide is wired when production
      // repositories are injected. Fail closed to aggregate no-op rather than
      // inventing a second plan store.
      return {
        evaluated: 0,
        created: 0,
        suppressed: 0,
        deliveryReady: 0,
        delivered: 0,
        failed: 0,
        note: "Plan scanner adapter pending; domain engine ready via LongitudinalEngagementService",
      };
    });

    logger.info("longitudinal engagement scan complete", summary);
    return { ok: true, ...summary };
  }
);
