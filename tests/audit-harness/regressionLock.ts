/**
 * Regression locking: compare gold-scenario outputs to snapshotted expectations.
 * Run with --update-snapshots to refresh expectations when business rules change deliberately.
 */

import * as path from "path";
import * as fs from "fs";
import type { ScenarioResult } from "./runner";

/** Scenario IDs that are locked for regression (gold patient, doctor, clinic). */
export const GOLD_SCENARIO_IDS = ["patient.complete-fue", "doctor.gold", "clinic.gold"] as const;

/** Stable snapshot of outputs we lock on (readable, easy to update). */
export interface ExpectedSnapshot {
  readinessResult: "pass" | "fail";
  missingCategories: string[];
  manifestStatus: string;
  manifestCategoriesRecognized: string[];
  validationResult: "pass" | "fail";
  scoringEligibility: string;
}

export type ExpectedOutputs = Record<string, ExpectedSnapshot>;

const SNAPSHOT_PATH = path.resolve(__dirname, "snapshots", "expectedOutputs.json");

function loadExpected(): ExpectedOutputs {
  if (!fs.existsSync(SNAPSHOT_PATH)) return {};
  const raw = fs.readFileSync(SNAPSHOT_PATH, "utf8");
  return JSON.parse(raw) as ExpectedOutputs;
}

function extractActual(result: ScenarioResult): ExpectedSnapshot {
  return {
    readinessResult: result.readinessResult as "pass" | "fail",
    missingCategories: [...result.missingCategories].sort(),
    manifestStatus: result.manifestStatus,
    manifestCategoriesRecognized: [...(result.manifestCategoriesRecognized ?? [])].sort(),
    validationResult: result.validationResult as "pass" | "fail",
    scoringEligibility: result.scoringEligibility,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const keysA = Object.keys(a as object).sort();
    const keysB = Object.keys(b as object).sort();
    if (keysA.length !== keysB.length || keysA.some((k, i) => keysA[i] !== keysB[i])) return false;
    return keysA.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** Format a single field diff for error message. */
function formatDiff(
  scenarioId: string,
  field: string,
  expected: unknown,
  actual: unknown
): string {
  return `  ${scenarioId}.${field}:\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`;
}

/**
 * Compare actual results to expected snapshots. Returns list of diff messages (empty if match).
 */
export function compareToExpected(results: ScenarioResult[]): string[] {
  const expected = loadExpected();
  const diffs: string[] = [];

  for (const scenarioId of GOLD_SCENARIO_IDS) {
    const exp = expected[scenarioId];
    if (!exp) {
      diffs.push(`  ${scenarioId}: missing in expectedOutputs.json (add an entry or run --update-snapshots)`);
      continue;
    }

    const result = results.find((r) => r.scenarioId === scenarioId);
    if (!result) continue; // scenario not run (e.g. --type=doctor); skip

    const actual = extractActual(result);
    const fields: (keyof ExpectedSnapshot)[] = [
      "readinessResult",
      "missingCategories",
      "manifestStatus",
      "manifestCategoriesRecognized",
      "validationResult",
      "scoringEligibility",
    ];
    for (const field of fields) {
      const e = exp[field];
      const a = actual[field];
      if (!deepEqual(e, a)) {
        diffs.push(formatDiff(scenarioId, field, e, a));
      }
    }
  }

  return diffs;
}

/**
 * Write current gold-scenario results to expectedOutputs.json. Use when rules change deliberately.
 */
export function updateSnapshots(results: ScenarioResult[]): void {
  let expected = loadExpected();
  if (Object.keys(expected).length === 0) expected = {} as ExpectedOutputs;

  for (const scenarioId of GOLD_SCENARIO_IDS) {
    const result = results.find((r) => r.scenarioId === scenarioId);
    if (result) {
      expected[scenarioId] = extractActual(result);
    }
  }

  const dir = path.dirname(SNAPSHOT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(expected, null, 2) + "\n", "utf8");
  console.log(`[regression] Updated ${SNAPSHOT_PATH}`);
}

/**
 * Run regression lock: compare or update. Returns true if locked (no drift or updated).
 */
export function runRegressionLock(
  results: ScenarioResult[],
  updateSnapshotsFlag: boolean
): { ok: boolean; message?: string } {
  if (updateSnapshotsFlag) {
    updateSnapshots(results);
    return { ok: true };
  }

  const diffs = compareToExpected(results);
  if (diffs.length === 0) return { ok: true };

  const message = [
    "Regression lock failed: gold scenario outputs differ from snapshots.",
    "If you changed business rules on purpose, run with --update-snapshots to refresh expectations.",
    "Otherwise fix the behavior or revert the change.",
    "",
    "Differences:",
    ...diffs,
    "",
    "Expected outputs: tests/audit-harness/snapshots/expectedOutputs.json",
  ].join("\n");

  return { ok: false, message };
}
