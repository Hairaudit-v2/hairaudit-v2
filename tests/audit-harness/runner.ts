/**
 * Audit test harness runner.
 * Creates cases, attaches answers and images, runs assertions, outputs JSON + Markdown.
 *
 * Usage: tsx tests/audit-harness/runner.ts [--type=patient|doctor|clinic] [--no-cleanup] [--update-snapshots]
 */

import { loadEnvLocal, getTestUserId, validateHarnessEnv } from "./helpers/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  printStartup,
  printScenarioStart,
  printScenarioSuccess,
  printScenarioFailure,
  printSummaryTable,
  printTotals,
  printOutputFiles,
  printRegressionDrift,
  printSetupFailure,
  printRunFailure,
} from "./helpers/output";
import { createTestCase, cleanupTestCase, getAuditorCaseSnapshot } from "./helpers/db";
import { attachImagesForScenario, insertLegacyUploadRow } from "./helpers/uploads";
import { saveAnswersForType } from "./helpers/answers";
import { prepareCaseEvidenceManifest } from "@/lib/evidence/prepareCaseEvidence";
import {
  computeReadinessForSubmitApi,
  getEvidenceAssertionResult,
  missingCategoriesMatch,
  validatePatientAnswersHarness,
  validateDoctorAnswersHarness,
  validateClinicAnswersHarness,
} from "./helpers/assertions";
import type { ScenarioDefinition } from "./types/scenario";
import { patientScenarios } from "./scenarios/patient.scenarios";
import { doctorScenarios } from "./scenarios/doctor.scenarios";
import { clinicScenarios } from "./scenarios/clinic.scenarios";
import * as path from "path";
import * as fs from "fs";
import { runRegressionLock } from "./regressionLock";
import type { RunMode } from "./helpers/output";

loadEnvLocal();

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

/** Human-readable outcome labels for report. */
export type ExpectedOutcomeLabel =
  | "readiness_pass"
  | "readiness_fail_missing_categories"
  | "readiness_fail_validation"
  | "scoring_eligible"
  | "scoring_blocked"
  | "provenance_captured"
  | "legacy_aliases_accepted"
  | "procedure_type_normalized";

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  submissionType: string;
  procedureType: string | undefined;
  passed: boolean;
  durationMs: number;
  caseId?: string;
  errors: string[];
  /** Expected outcome (short label) */
  expectedOutcome: string;
  /** Actual outcome (short label) */
  actualOutcome: string;
  /** Form validation: pass | fail */
  validationResult: "pass" | "fail";
  /** Form validation: missing field paths */
  missingFields: string[];
  /** Photo readiness: missing required categories */
  missingCategories: string[];
  /** Readiness: pass | fail */
  readinessResult: "pass" | "fail";
  /** Manifest status from case_evidence_manifests (e.g. ready | incomplete) */
  manifestStatus: string;
  /** Categories present in manifest prepared_images (sorted, for regression snapshots) */
  manifestCategoriesRecognized: string[];
  /** Scoring: eligible | blocked | not_asserted */
  scoringResult: "eligible" | "blocked" | "not_asserted";
  /** Scoring eligibility (same as scoringResult for report clarity) */
  scoringEligibility: string;
  /** Auditor-facing snapshot: case status, missing evidence, report presence */
  auditorVisibilityResult: Record<string, unknown>;
  assertions: {
    caseCreated?: boolean;
    answersStored?: boolean;
    uploadsStored?: boolean;
    readinessPass?: boolean;
    readinessActual?: boolean;
    missingCategoriesMatch?: boolean;
    evidenceManifestReady?: boolean;
    scoringEligible?: boolean;
    auditorVisibilityConsistent?: boolean;
  };
  details?: Record<string, unknown>;
}

function getAllScenarios(type?: "patient" | "doctor" | "clinic"): ScenarioDefinition[] {
  const all = [
    ...patientScenarios,
    ...doctorScenarios,
    ...clinicScenarios,
  ];
  if (type) return all.filter((s) => s.meta.submissionType === type);
  return all;
}

function getValidationMissingFields(
  submissionType: string,
  answers: Record<string, unknown>
): string[] {
  try {
    if (submissionType === "patient") {
      return validatePatientAnswersHarness(answers).missingFieldPaths;
    }
    if (submissionType === "doctor") {
      return validateDoctorAnswersHarness(answers).missingFieldPaths;
    }
    if (submissionType === "clinic") {
      return validateClinicAnswersHarness(answers).missingFieldPaths;
    }
  } catch (_) {
    // Schema may have heavy deps; return empty on error
  }
  return [];
}

function deriveExpectedOutcome(scenario: ScenarioDefinition): string {
  const e = scenario.expectations;
  const labels: string[] = [];
  if (e.readinessPass === true) labels.push("readiness_pass");
  if (e.readinessPass === false) labels.push("readiness_fail_missing_categories");
  if (e.scoringEligible) labels.push("scoring_eligible");
  if (e.scoringBlocked) labels.push("scoring_blocked");
  if (e.provenancePresent) labels.push("provenance_captured");
  if (scenario.meta.legacyAliases) labels.push("legacy_aliases_accepted");
  if (scenario.meta.procedureType) labels.push("procedure_type_normalized");
  return labels.length ? labels.join(", ") : "—";
}

function deriveActualOutcome(
  readinessCanSubmit: boolean,
  scoringEligible: boolean,
  scoringBlocked: boolean
): string {
  const labels: string[] = [];
  labels.push(readinessCanSubmit ? "readiness_pass" : "readiness_fail");
  if (scoringBlocked) labels.push("scoring_blocked");
  else if (scoringEligible) labels.push("scoring_eligible");
  else labels.push("scoring_not_asserted");
  return labels.join(", ");
}

async function runScenario(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  scenario: ScenarioDefinition,
  userId: string,
  cleanup: boolean
): Promise<ScenarioResult> {
  const start = Date.now();
  const errors: string[] = [];
  const assertions: ScenarioResult["assertions"] = {};
  let caseId: string | undefined;
  let missingFields: string[] = [];
  let missingCategories: string[] = [];
  let readinessCanSubmit = false;
  let scoringEligible = false;
  let scoringBlocked = false;
  let manifest: Awaited<ReturnType<typeof prepareCaseEvidenceManifest>>["manifest"] | null = null;
  let auditorSnapshot: Awaited<ReturnType<typeof getAuditorCaseSnapshot>> | null = null;

  try {
    const { meta, answers: rawAnswers, imageMapping, expectations } = scenario;

    const { id } = await createTestCase(supabase, {
      auditType: meta.submissionType,
      userId,
      title: `qa_automated_${meta.id}`,
    });
    caseId = id;
    assertions.caseCreated = true;

    const answers =
      meta.submissionType === "doctor" || meta.submissionType === "clinic"
        ? { ...rawAnswers, case_id: id }
        : rawAnswers;
    missingFields = getValidationMissingFields(meta.submissionType, answers);

    await saveAnswersForType(supabase, id, meta.submissionType, answers);
    assertions.answersStored = true;

    const fixturesDir = path.resolve(__dirname, "fixtures", "images", meta.submissionType);
    const photos = await attachImagesForScenario(supabase, {
      caseId: id,
      userId,
      submissionType: meta.submissionType,
      imageMapping,
      fixturesDir: fs.existsSync(fixturesDir) ? fixturesDir : undefined,
    });
    if (scenario.legacyUploads?.length) {
      for (const leg of scenario.legacyUploads) {
        const segment = leg.type.startsWith("patient_photo:") ? "patient" : leg.type.startsWith("clinic_photo:") ? "clinic" : "doctor";
        const storage_path =
          leg.storage_path ?? `cases/${id}/${segment}/${leg.type.split(":")[1]}/legacy-${Date.now()}.jpg`;
        const { type } = await insertLegacyUploadRow(supabase, {
          caseId: id,
          userId,
          type: leg.type,
          storage_path,
        });
        photos.push({ type });
      }
    }
    assertions.uploadsStored = true;

    const readiness = computeReadinessForSubmitApi(meta.submissionType, photos);
    readinessCanSubmit = readiness.canSubmit;
    missingCategories = readiness.missingRequired;
    assertions.readinessActual = readiness.canSubmit;
    if (expectations.readinessPass !== undefined) {
      assertions.readinessPass = expectations.readinessPass === readiness.canSubmit;
      if (!assertions.readinessPass) {
        errors.push(
          `Readiness mismatch: expected canSubmit=${expectations.readinessPass}, got ${readiness.canSubmit}. Missing: [${readiness.missingRequired.join(", ")}]`
        );
      }
    }
    if (expectations.expectedMissingCategories?.length) {
      const match = missingCategoriesMatch(readiness.missingRequired, expectations.expectedMissingCategories);
      assertions.missingCategoriesMatch = match.match;
      if (!match.match && match.message) errors.push(match.message);
    }

    try {
      const result = await prepareCaseEvidenceManifest({
        supabase,
        caseId: id,
        bucket: BUCKET,
      });
      manifest = result.manifest;
      assertions.evidenceManifestReady = manifest.status === "ready";
      if (expectations.evidenceRecognizesCategories && manifest.status !== "ready") {
        errors.push(`Evidence manifest status: ${manifest.status}, expected ready. Errors: ${(manifest as any).errors?.join(", ")}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Evidence preparation failed: ${msg}`);
    }

    if (expectations.scoringEligible !== undefined) {
      scoringEligible = readiness.canSubmit && (manifest?.status === "ready" || !manifest);
      assertions.scoringEligible = scoringEligible;
    }
    if (expectations.scoringBlocked !== undefined) {
      scoringBlocked = expectations.scoringBlocked && !readiness.canSubmit;
    }

    auditorSnapshot = await getAuditorCaseSnapshot(supabase, id);
    assertions.auditorVisibilityConsistent =
      auditorSnapshot.caseStatus === "draft" &&
      (manifest?.status === "ready" ? auditorSnapshot.manifestStatus === "ready" : true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    if (!assertions.caseCreated && caseId) {
      try {
        await cleanupTestCase(supabase, caseId);
      } catch (_) {}
    }
  }

  if (cleanup && caseId) {
    try {
      await cleanupTestCase(supabase, caseId);
    } catch (e) {
      errors.push(`Cleanup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const passed = errors.length === 0 && (scenario.expectations.readinessPass === undefined || assertions.readinessPass === true);
  const expectedOutcome = deriveExpectedOutcome(scenario);
  const actualOutcome = deriveActualOutcome(readinessCanSubmit, scoringEligible, scoringBlocked);
  const validationPass = missingFields.length === 0;
  const auditorVisibilityResult: Record<string, unknown> =
    auditorSnapshot != null
      ? (auditorSnapshot as unknown as Record<string, unknown>)
      : caseId && !cleanup
        ? ((await getAuditorCaseSnapshot(supabase, caseId)) as unknown as Record<string, unknown>)
        : {};

  return {
    scenarioId: scenario.meta.id,
    scenarioName: scenario.meta.name,
    submissionType: scenario.meta.submissionType,
    procedureType: scenario.meta.procedureType,
    passed: passed && errors.length === 0,
    durationMs: Date.now() - start,
    caseId: cleanup ? undefined : caseId,
    errors,
    expectedOutcome,
    actualOutcome,
    validationResult: validationPass ? "pass" : "fail",
    missingFields,
    missingCategories,
    readinessResult: readinessCanSubmit ? "pass" : "fail",
    manifestStatus: manifest?.status ?? "—",
    manifestCategoriesRecognized: (manifest?.prepared_images ?? []).map((p: { category: string }) => p.category).sort(),
    scoringResult: scoringBlocked ? "blocked" : scoringEligible ? "eligible" : "not_asserted",
    scoringEligibility: scoringBlocked ? "blocked" : scoringEligible ? "eligible" : "not_asserted",
    auditorVisibilityResult,
    assertions,
    details: {
      expectedReadinessPass: scenario.expectations.readinessPass,
      expectedMissingCategories: scenario.expectations.expectedMissingCategories,
    },
  };
}

export async function runHarness(options: {
  type?: "patient" | "doctor" | "clinic";
  cleanup?: boolean;
  onScenarioStart?: (scenario: ScenarioDefinition) => void;
  onScenarioDone?: (result: ScenarioResult) => void;
}): Promise<{ results: ScenarioResult[]; summary: { total: number; passed: number; failed: number } }> {
  const { type, cleanup = true, onScenarioStart, onScenarioDone } = options;
  const supabase = createSupabaseAdminClient();
  const userId = getTestUserId();
  const scenarios = getAllScenarios(type);
  const results: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    onScenarioStart?.(scenario);
    const result = await runScenario(supabase, scenario, userId, cleanup);
    results.push(result);
    onScenarioDone?.(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  return {
    results,
    summary: { total: results.length, passed, failed },
  };
}

function writeOutputs(output: Awaited<ReturnType<typeof runHarness>>): { jsonPath: string; mdPath: string } {
  const outDir = path.resolve(__dirname, "..", "audit-harness-output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const jsonPath = path.join(outDir, `results-${stamp}.json`);
  const mdPath = path.join(outDir, `summary-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), "utf8");
  fs.writeFileSync(mdPath, buildMarkdownSummary(output), "utf8");
  return { jsonPath, mdPath };
}

function buildMarkdownSummary(output: Awaited<ReturnType<typeof runHarness>>): string {
  const md: string[] = [
    "# Audit Test Harness Summary",
    "",
    `**Run:** ${new Date().toISOString()}`,
    `**Total:** ${output.summary.total} | **Passed:** ${output.summary.passed} | **Failed:** ${output.summary.failed}`,
    "",
    "## Results",
    "",
  ];
  for (const r of output.results) {
    md.push(`### ${r.scenarioId} — ${r.scenarioName}`);
    md.push(`| Field | Value |`);
    md.push(`|-------|-------|`);
    md.push(`| **Pass/Fail** | ${r.passed ? "PASS" : "FAIL"} |`);
    md.push(`| **Scenario name** | ${r.scenarioName} |`);
    md.push(`| **Submission type** | ${r.submissionType} |`);
    md.push(`| **Procedure type** | ${r.procedureType ?? "—"} |`);
    md.push(`| **Validation result** | ${r.validationResult} |`);
    md.push(`| **Expected outcome** | ${r.expectedOutcome} |`);
    md.push(`| **Actual outcome** | ${r.actualOutcome} |`);
    md.push(`| **Readiness result** | ${r.readinessResult} |`);
    md.push(`| **Missing fields** | ${r.missingFields.length ? r.missingFields.join(", ") : "—"} |`);
    md.push(`| **Missing categories** | ${r.missingCategories.length ? r.missingCategories.join(", ") : "—"} |`);
    md.push(`| **Manifest status** | ${r.manifestStatus} |`);
    md.push(`| **Scoring eligibility** | ${r.scoringEligibility} |`);
    md.push(`| **Auditor visibility result** | ${JSON.stringify(r.auditorVisibilityResult)} |`);
    md.push(`| **Duration** | ${r.durationMs}ms |`);
    if (r.errors.length) {
      md.push("");
      md.push("**Errors:**");
      r.errors.forEach((e) => md.push(`- ${e}`));
    }
    md.push("");
    md.push("**Assertions:** `" + JSON.stringify(r.assertions) + "`");
    md.push("");
  }
  return md.join("\n");
}

function getCountsByType(scenarios: ScenarioDefinition[]): { patient: number; doctor: number; clinic: number } {
  return {
    patient: scenarios.filter((s) => s.meta.submissionType === "patient").length,
    doctor: scenarios.filter((s) => s.meta.submissionType === "doctor").length,
    clinic: scenarios.filter((s) => s.meta.submissionType === "clinic").length,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let type: "patient" | "doctor" | "clinic" | undefined;
  let cleanup = true;
  let updateSnapshots = false;
  for (const a of args) {
    if (a.startsWith("--type=")) type = a.slice(7) as "patient" | "doctor" | "clinic";
    if (a === "--no-cleanup") cleanup = false;
    if (a === "--update-snapshots") updateSnapshots = true;
  }

  try {
    validateHarnessEnv();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    printSetupFailure(msg);
    printRunFailure("setup");
    process.exit(1);
  }

  const scenarios = getAllScenarios(type);
  const mode: RunMode = { type, cleanup, updateSnapshots };

  printStartup({
    cwd: process.cwd(),
    mode,
    scenarioCount: scenarios.length,
    countsByType: getCountsByType(scenarios),
  });

  const output = await runHarness({
    type,
    cleanup,
    onScenarioStart: (s) => printScenarioStart(s.meta.id, s.meta.name),
    onScenarioDone: (r) => (r.passed ? printScenarioSuccess(r) : printScenarioFailure(r)),
  });

  const { jsonPath, mdPath } = writeOutputs(output);

  printSummaryTable(output.results);
  printTotals(output.summary.passed, output.summary.failed, output.summary.total);
  printOutputFiles(jsonPath, mdPath);

  const lock = runRegressionLock(output.results, updateSnapshots);
  if (!lock.ok) {
    printRegressionDrift(lock.message!);
    printRunFailure("regression");
    process.exit(1);
  }

  if (output.summary.failed > 0) {
    printRunFailure("scenarios");
    process.exit(1);
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    msg.includes("Missing required") ||
    msg.includes("HARNESS_TEST_USER_ID") ||
    msg.includes("Supabase env") ||
    msg.includes(".env.local")
  ) {
    printSetupFailure(msg);
    printRunFailure("setup");
  } else {
    console.error(e);
  }
  process.exit(1);
});
