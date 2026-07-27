/**
 * FI-OUTCOME-INTELLIGENCE-1A — Safe backfill for de-identified cohort rows.
 *
 * Dry-run by default. No PHI logs. Idempotent. Does not mutate 1D/1E/1F sources.
 *
 * Usage:
 *   pnpm outcome-cohort:backfill --dry-run
 *   pnpm outcome-cohort:backfill --apply
 *
 * Env (required for --apply):
 *   FI_OUTCOME_COHORT_ENABLED=true
 *   FI_OUTCOME_COHORT_HMAC_SECRET=<secret>
 *   FI_OUTCOME_COHORT_GOVERNANCE_APPROVED=true
 *
 * Optional:
 *   FI_OUTCOME_COHORT_BACKFILL_BATCH_SIZE=50
 *   FI_OUTCOME_COHORT_BACKFILL_CHECKPOINT=<comparison_id>
 *
 * Note: This script is designed for operator use with an injected comparison
 * ID list or in-process repository wiring. Without a live Supabase adapter it
 * reports configuration + dry-run contract only.
 */

import { resolveOutcomeCohortConfig, assertCohortMaterializationAllowed } from "../src/lib/outcomeIntelligence/cohortConfig";
import { evaluateCohortGovernance } from "../src/lib/outcomeIntelligence/cohortGovernance";

type BackfillArgs = {
  dryRun: boolean;
  apply: boolean;
  batchSize: number;
  checkpoint: string | null;
  comparisonIds: string[];
};

function parseArgs(argv: string[]): BackfillArgs {
  const dryRun = argv.includes("--dry-run") || !argv.includes("--apply");
  const apply = argv.includes("--apply");
  let batchSize = 50;
  let checkpoint: string | null = null;
  const comparisonIds: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--batch-size" && argv[i + 1]) {
      batchSize = Math.max(1, Number.parseInt(argv[++i]!, 10) || 50);
    } else if (a === "--checkpoint" && argv[i + 1]) {
      checkpoint = argv[++i]!;
    } else if (a === "--comparison-ids" && argv[i + 1]) {
      comparisonIds.push(
        ...argv[++i]!
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }

  const envBatch = Number.parseInt(
    String(process.env.FI_OUTCOME_COHORT_BACKFILL_BATCH_SIZE ?? ""),
    10
  );
  if (Number.isFinite(envBatch) && envBatch > 0) batchSize = envBatch;
  if (!checkpoint && process.env.FI_OUTCOME_COHORT_BACKFILL_CHECKPOINT) {
    checkpoint = String(process.env.FI_OUTCOME_COHORT_BACKFILL_CHECKPOINT).trim();
  }

  return {
    dryRun: apply ? false : dryRun,
    apply,
    batchSize,
    checkpoint,
    comparisonIds,
  };
}

export type BackfillPreflightReport = {
  mode: "dry-run" | "apply";
  governanceStatus: string;
  gateOk: boolean;
  gateCode: string | null;
  eligibleComparisonIds: number;
  uniqueProceduresUnknown: true;
  rowsToMaterializeUnknown: true;
  rowsAlreadyMaterializedUnknown: true;
  batchSize: number;
  checkpoint: string | null;
  notes: string[];
};

/**
 * Preflight counts only — no PHI. Without a wired repository, reports gate status
 * and eligible ID count from CLI input.
 */
export function buildBackfillPreflight(args: BackfillArgs): BackfillPreflightReport {
  const config = resolveOutcomeCohortConfig();
  const governance = evaluateCohortGovernance({
    governanceApprovedEnv: config.governanceApproved,
  });
  const gate = assertCohortMaterializationAllowed(config);

  const notes: string[] = [
    "Dry-run default: no writes.",
    "No patient/case/name/email identifiers are logged.",
    "Source 1D/1E/1F snapshots are never mutated.",
    "Idempotent materialization uses procedure HMAC + checksums + domain + schema version.",
  ];

  if (!gate.ok) {
    notes.push(`Gate blocked: ${gate.code} — ${gate.reason}`);
  }

  if (args.comparisonIds.length === 0) {
    notes.push(
      "No --comparison-ids provided. Wire a service-role listing of active 1F comparisons for full preflight counts."
    );
  }

  return {
    mode: args.apply ? "apply" : "dry-run",
    governanceStatus: governance.status,
    gateOk: gate.ok,
    gateCode: gate.ok ? null : gate.code,
    eligibleComparisonIds: args.comparisonIds.length,
    uniqueProceduresUnknown: true,
    rowsToMaterializeUnknown: true,
    rowsAlreadyMaterializedUnknown: true,
    batchSize: args.batchSize,
    checkpoint: args.checkpoint,
    notes,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = buildBackfillPreflight(args);

  // Safe structured output — counts and codes only
  console.log(JSON.stringify(report, null, 2));

  if (args.apply) {
    if (!report.gateOk) {
      console.error("Fail closed: cannot apply without enabled + secret + governance approval.");
      process.exitCode = 1;
      return;
    }
    if (args.comparisonIds.length === 0) {
      console.error(
        "Fail closed: --apply requires --comparison-ids until a live comparison listing adapter is wired."
      );
      process.exitCode = 1;
      return;
    }
    console.error(
      "Apply path requires in-process repository wiring (service role). Use materialization service from a trusted operator job."
    );
    process.exitCode = 1;
  }
}

const isDirect =
  typeof process.argv[1] === "string" &&
  (process.argv[1].includes("backfill-outcome-cohort") ||
    process.argv[1].endsWith("backfill-outcome-cohort.ts"));

if (isDirect) {
  void main();
}
