/**
 * FI-OUTCOME-INTELLIGENCE-1D — Longitudinal engagement dry-run / apply CLI.
 *
 * Usage:
 *   pnpm longitudinal-engagement:run
 *   pnpm longitudinal-engagement:run --dry-run
 *   pnpm longitudinal-engagement:run --apply
 *   pnpm longitudinal-engagement:run --apply --historical-recovery
 *
 * Default: dry-run. Aggregate counts only. No PHI.
 * Apply fails closed unless FI_LONGITUDINAL_ENGAGEMENT_ENABLED=true
 * and persist or a delivery channel is configured.
 */

import {
  createLongitudinalEngagementService,
  InMemoryEngagementAuditSink,
} from "../src/lib/outcomeIntelligence/longitudinalEngagementService";
import { InMemoryLongitudinalEngagementEventRepository } from "../src/lib/outcomeIntelligence/longitudinalEngagementRepository";
import {
  assertEngagementApplyAllowed,
  resolveLongitudinalEngagementConfig,
} from "../src/lib/outcomeIntelligence/longitudinalEngagementConfig";
import { describeEngagementTimingPolicy } from "../src/lib/outcomeIntelligence/longitudinalEngagementPolicy";
import { COMMUNICATION_PREFERENCE_GAP } from "../src/lib/outcomeIntelligence/longitudinalEngagementSafety";
import type { EngagementBatchHealth } from "../src/lib/outcomeIntelligence/longitudinalEngagementTypes";

type CliArgs = {
  dryRun: boolean;
  apply: boolean;
  historicalRecovery: boolean;
  json: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const apply = argv.includes("--apply");
  return {
    apply,
    dryRun: !apply || argv.includes("--dry-run"),
    historicalRecovery: argv.includes("--historical-recovery"),
    json: argv.includes("--json"),
  };
}

function emptyHealth(): EngagementBatchHealth {
  return {
    eligibleMilestones: 0,
    eventsCreated: 0,
    eventsReused: 0,
    eventsSuppressed: 0,
    deliveryReady: 0,
    delivered: 0,
    failed: 0,
    byEventType: {},
    byStage: {},
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = resolveLongitudinalEngagementConfig();

  if (args.apply) {
    const gate = assertEngagementApplyAllowed(config);
    if (!gate.ok) {
      console.error(
        JSON.stringify({
          ok: false,
          mode: "apply",
          code: gate.code,
          reason: gate.reason,
          failClosed: true,
        })
      );
      process.exitCode = 1;
      return;
    }
  }

  const repo = new InMemoryLongitudinalEngagementEventRepository();
  const audit = new InMemoryEngagementAuditSink();
  createLongitudinalEngagementService({
    eventRepository: repo,
    config: args.apply
      ? config
      : { ...config, enabled: config.enabled || true },
    auditSink: audit,
    dryRun: !args.apply,
    allowHistoricalRecovery: args.historicalRecovery,
  });

  // Without a wired plan scanner, report empty aggregate honestly.
  // Worker/script integration loads capture plans when adapters are connected.
  const health = emptyHealth();

  const payload = {
    ok: true,
    mode: args.apply ? "apply" : "dry-run",
    policy: describeEngagementTimingPolicy(),
    featureEnabled: config.enabled,
    channels: {
      email: config.emailEnabled,
      sms: config.smsEnabled,
      push: config.pushEnabled,
      externalDeliveryDeferred: true,
    },
    historicalRecovery: args.historicalRecovery,
    communicationPreferenceGap: COMMUNICATION_PREFERENCE_GAP,
    cohortGovernanceIndependent: true,
    milestonesEvaluated: health.eligibleMilestones,
    wouldCreate: health.eventsCreated,
    wouldSuppress: health.eventsSuppressed,
    byEventType: health.byEventType,
    note:
      "No capture-plan scanner wired in CLI yet; aggregates are zero until plans are supplied. Domain engine is testable via unit suites.",
  };

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("FI-OUTCOME-INTELLIGENCE-1D longitudinal engagement");
    console.log(`mode=${payload.mode} featureEnabled=${payload.featureEnabled}`);
    console.log(`milestones evaluated: ${payload.milestonesEvaluated}`);
    console.log(`would create: ${payload.wouldCreate}`);
    console.log(`would suppress: ${payload.wouldSuppress}`);
    console.log(`by event type: ${JSON.stringify(payload.byEventType)}`);
    console.log(`external delivery: deferred (channel-neutral events only)`);
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  );
  process.exitCode = 1;
});
