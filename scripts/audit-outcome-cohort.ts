/**
 * FI-OUTCOME-INTELLIGENCE-1B — Safe aggregate cohort data-quality audit CLI.
 *
 * Usage:
 *   pnpm outcome-cohort:audit
 *   pnpm outcome-cohort:audit --json
 *   pnpm outcome-cohort:audit --json --write-artifact
 *
 * Aggregate metrics only. No raw rows, HMAC keys, patient/case IDs.
 * Does not enable production materialization or set governance approval.
 *
 * Without a wired repository, reports empty-cohort / not_enabled status honestly.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOutcomeCohortDataQualityAuditService,
  formatAuditHumanReadable,
  sanitizeAuditForExport,
} from "../src/lib/outcomeIntelligence/cohortDataQualityAudit";
import { InMemoryOutcomeCohortRepository } from "../src/lib/outcomeIntelligence/cohortRepository";
import { evaluateCohortGovernance } from "../src/lib/outcomeIntelligence/cohortGovernance";
import { resolveOutcomeCohortConfig } from "../src/lib/outcomeIntelligence/cohortConfig";

type CliArgs = {
  json: boolean;
  writeArtifact: boolean;
  staging: boolean;
  productionAggregate: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  return {
    json: argv.includes("--json"),
    writeArtifact: argv.includes("--write-artifact"),
    staging: argv.includes("--staging"),
    productionAggregate: argv.includes("--production-aggregate"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = resolveOutcomeCohortConfig();
  const governance = evaluateCohortGovernance({
    governanceApprovedEnv: config.governanceApproved,
  });

  // Default: empty in-memory cohort (honest empty / not_enabled when gated).
  // Staging/production adapters are not wired in 1B — report that clearly.
  const repo = new InMemoryOutcomeCohortRepository();
  const service = createOutcomeCohortDataQualityAuditService({
    cohortRepository: repo,
    materializationEnabled: config.enabled,
  });

  const audit = sanitizeAuditForExport(await service.runCohortDataQualityAudit());

  if (args.staging || args.productionAggregate) {
    // Do not fabricate; note adapter absence in flags/notes via stderr
    console.error(
      JSON.stringify({
        note: args.productionAggregate
          ? "production-aggregate adapter not wired; reporting local/empty cohort honestly"
          : "staging adapter not wired; reporting local/empty cohort honestly",
        governanceStatus: governance.status,
        productionActivationNotModified: true,
      })
    );
  }

  if (args.json || args.writeArtifact) {
    const payload = JSON.stringify(audit, null, 2);
    if (args.json) console.log(payload);
    if (args.writeArtifact) {
      const root = join(dirname(fileURLToPath(import.meta.url)), "..");
      const out = join(root, "tmp", "outcome-cohort-data-quality-audit.json");
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, payload, "utf8");
      console.error(`Wrote aggregate artifact: ${out}`);
    }
  } else {
    console.log(formatAuditHumanReadable(audit));
  }
}

const isDirect =
  typeof process.argv[1] === "string" &&
  (process.argv[1].includes("audit-outcome-cohort") ||
    process.argv[1].endsWith("audit-outcome-cohort.ts"));

if (isDirect) {
  void main();
}
