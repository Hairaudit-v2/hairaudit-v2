/**
 * Terminal output for the audit harness: banner, progress, summary table, failure reasons.
 * Uses chalk and cli-table3 (existing deps) for readable, colored output.
 */

import chalk from "chalk";
import Table from "cli-table3";
import type { ScenarioResult } from "../runner";

const BANNER = "HairAudit Automated Audit Harness";

export interface RunMode {
  type?: "patient" | "doctor" | "clinic";
  cleanup: boolean;
  updateSnapshots: boolean;
}

export function printStartup(options: {
  cwd: string;
  mode: RunMode;
  scenarioCount: number;
  countsByType: { patient: number; doctor: number; clinic: number };
}): void {
  const { cwd, mode, scenarioCount, countsByType } = options;
  console.log("");
  console.log(chalk.bold.cyan(BANNER));
  console.log(chalk.dim("—".repeat(Math.min(60, BANNER.length + 4))));
  console.log(chalk.dim(`Working directory: ${cwd}`));
  const modeParts: string[] = [];
  if (mode.type) modeParts.push(`type=${mode.type}`);
  else modeParts.push("all scenarios");
  modeParts.push(mode.cleanup ? "cleanup=on" : "cleanup=off");
  if (mode.updateSnapshots) modeParts.push(chalk.yellow("update-snapshots"));
  console.log(chalk.dim(`Mode: ${modeParts.join(" | ")}`));
  console.log(
    chalk.dim(
      `Scenarios: ${scenarioCount} total (patient: ${countsByType.patient}, doctor: ${countsByType.doctor}, clinic: ${countsByType.clinic})`
    )
  );
  console.log("");
}

export function printScenarioStart(scenarioId: string, scenarioName: string): void {
  console.log(chalk.cyan("▶"), chalk.bold(scenarioId), chalk.dim("—"), scenarioName);
}

/** Compact one-line state: validation | manifest | readiness | scoreEligible */
function compactStateLine(r: ScenarioResult): string {
  const v = r.validationResult === "pass" ? "pass" : "fail";
  const m = r.manifestStatus === "ready" ? "ready" : r.manifestStatus;
  const re = r.readinessResult === "pass" ? "pass" : "fail";
  const s = r.scoringEligibility === "eligible" ? "yes" : r.scoringEligibility === "blocked" ? "no" : "—";
  return `validation=${v} | manifest=${m} | readiness=${re} | scoreEligible=${s}`;
}

export function printScenarioSuccess(r: ScenarioResult): void {
  const line = compactStateLine(r);
  console.log(chalk.green("  ✓ PASS"), chalk.dim(line), chalk.dim(`(${r.durationMs}ms)`));
  console.log("");
}

export function printScenarioFailure(r: ScenarioResult): void {
  const line = compactStateLine(r);
  console.log(chalk.red("  ✗ FAIL"), chalk.dim(line), chalk.dim(`(${r.durationMs}ms)`));
  const reason = r.errors.length ? r.errors[0] : "Unknown error";
  console.log(chalk.red("  Reason:"), reason);
  if (r.errors.length > 1) {
    r.errors.slice(1).forEach((e) => console.log(chalk.red("         "), e));
  }
  console.log("");
}

export function printSummaryTable(results: ScenarioResult[]): void {
  const head = [
    "Scenario",
    "Type",
    "Validation",
    "Manifest",
    "Readiness",
    "Score Eligible",
    "Result",
  ];
  const table = new Table({
    head: head.map((h) => chalk.bold(h)),
    style: { head: [], border: ["grey"] },
  });
  for (const r of results) {
    table.push([
      r.scenarioId,
      r.submissionType,
      r.validationResult,
      r.manifestStatus,
      r.readinessResult,
      r.scoringEligibility === "eligible" ? "yes" : r.scoringEligibility === "blocked" ? "no" : "—",
      r.passed ? chalk.green("PASS") : chalk.red("FAIL"),
    ]);
  }
  console.log(table.toString());
}

export function printTotals(passed: number, failed: number, total: number): void {
  console.log(
    chalk.bold("Totals:"),
    chalk.green(`passed ${passed}`),
    failed > 0 ? chalk.red(`failed ${failed}`) : chalk.dim("failed 0"),
    chalk.dim(`total ${total}`)
  );
  console.log("");
}

export function printOutputFiles(jsonPath: string, mdPath: string): void {
  console.log(chalk.dim("Output files:"));
  console.log(chalk.dim(`  JSON:    ${jsonPath}`));
  console.log(chalk.dim(`  Markdown: ${mdPath}`));
  console.log("");
}

export function printRegressionDrift(message: string): void {
  console.log("");
  console.log(chalk.bold.red("Regression lock failed"));
  console.log(chalk.red("Gold scenario outputs differ from snapshots."));
  console.log("");
  console.log(chalk.dim(message));
  console.log("");
  console.log(chalk.yellow("If you changed business rules on purpose, run with --update-snapshots to refresh expectations."));
  console.log("");
}

export function printSetupFailure(message: string): void {
  console.log("");
  console.log(chalk.bold.red("Setup error: missing environment variable(s)"));
  console.log("");
  console.log(chalk.red(message));
  console.log("");
  console.log(chalk.dim("Add the variable(s) to .env.local at the project root, then run the harness again."));
  console.log("");
}

export function printRunFailure(reason: "scenarios" | "regression" | "setup"): void {
  console.log("");
  if (reason === "scenarios") {
    console.log(chalk.bold.red("Run failed: one or more scenarios failed."));
  } else if (reason === "regression") {
    console.log(chalk.bold.red("Run failed: regression snapshot drift (see above)."));
  } else {
    console.log(chalk.bold.red("Run failed: setup issue (see above)."));
  }
  console.log("");
}
