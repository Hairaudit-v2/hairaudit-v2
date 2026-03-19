/**
 * Read-only certification engine test harness.
 * Validates behavior across realistic and edge-case datasets. No DB access; no production UI.
 * Safe to delete later. Do not modify the certification engine logic from this file.
 */

import {
  evaluateCertification,
  isCaseEligible,
  CERTIFICATION_TIER_RULES,
} from "../src/lib/certification";
import type { CaseWithReportForCert, CaseRowForCert, ReportSummaryForCert } from "../src/lib/certification";

// --- Mock helper ---

type MockCaseOverrides = Partial<{
  id: string;
  status: string;
  audit_mode: string | null;
  visibility_scope: string | null;
  is_demo: boolean | null;
  is_invalid: boolean | null;
}>;

type MockSummaryOverrides = Partial<{
  performance_score: number;
  benchmark_score: number;
  confidence_multiplier: number;
  documentation_integrity: number;
}>;

let caseIdCounter = 0;

function mockCaseWithReport(
  summaryOverrides: MockSummaryOverrides = {},
  caseOverrides: MockCaseOverrides = {}
): CaseWithReportForCert {
  const id = caseOverrides.id ?? `case-${++caseIdCounter}`;
  const status = caseOverrides.status ?? "complete";
  const audit_mode = caseOverrides.audit_mode ?? "public";
  const visibility_scope = caseOverrides.visibility_scope ?? null;
  const perf = summaryOverrides.performance_score ?? summaryOverrides.benchmark_score ?? 80;
  const conf = summaryOverrides.confidence_multiplier ?? 0.75;
  const di = summaryOverrides.documentation_integrity ?? 75;

  const caseRow: CaseRowForCert = {
    id,
    status,
    audit_mode,
    visibility_scope,
    is_demo: caseOverrides.is_demo ?? null,
    is_invalid: caseOverrides.is_invalid ?? null,
  };

  const latestReportSummary: ReportSummaryForCert = {
    forensic_audit: {
      overall_scores_v1: {
        performance_score: perf,
        benchmark_score: perf,
        confidence_multiplier: conf,
        confidence_grade: conf >= 0.8 ? "high" : conf >= 0.6 ? "medium" : "low",
      },
      domain_scores_v1: {
        domains: [{ domain_id: "DI", weighted_score: di }],
      },
      benchmark: { eligible: true, overall_confidence: conf },
    },
  };

  return { case: caseRow, latestReportSummary };
}

function toFixedSmart(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return Number(n.toFixed(digits)).toString();
}

function getEngineOverallScore(summary: ReportSummaryForCert | null | undefined): number | null {
  if (!summary) return null;
  const forensic = summary.forensic_audit ?? summary.forensic;
  const v1 = forensic?.overall_scores_v1;
  if (!v1) return null;
  const score = v1.performance_score ?? v1.benchmark_score;
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

function getEngineConfidence(summary: ReportSummaryForCert | null | undefined): number | null {
  if (!summary) return null;
  const forensic = summary.forensic_audit ?? summary.forensic;
  const v1 = forensic?.overall_scores_v1;
  if (!v1) return null;
  const bench = forensic?.benchmark as { overall_confidence?: number } | undefined;
  const mult = v1.confidence_multiplier ?? bench?.overall_confidence;
  const n = Number(mult);
  return Number.isFinite(n) ? n : null;
}

function getEngineIntegrity(summary: ReportSummaryForCert | null | undefined): number | null {
  if (!summary) return null;
  const forensic = summary.forensic_audit ?? summary.forensic;
  const domains = forensic?.domain_scores_v1?.domains ?? [];
  const di = domains.find((d) => String(d?.domain_id ?? "") === "DI");
  const n = Number(di?.weighted_score);
  return Number.isFinite(n) ? n : null;
}

function printTierThresholdSnapshot(currentTier: string | null, nextTier: string | null): void {
  console.log("Threshold snapshot (next tier)");
  if (!nextTier) {
    console.log("  — No next tier");
    return;
  }

  const rule = CERTIFICATION_TIER_RULES[nextTier as keyof typeof CERTIFICATION_TIER_RULES];
  if (!rule) {
    console.log("  — Missing rule data");
    return;
  }

  console.log(`  Current tier: ${currentTier == null ? "No certification yet" : currentTier}`);
  console.log(`  Next tier:    ${nextTier}`);
  console.log("  Requirements:");
  console.log(`    eligiblePublicCases >= ${rule.minEligiblePublicCases}`);
  console.log(`    entityCertificationScore >= ${rule.minEntityCertificationScore}`);
  console.log(`    weightedCaseQuality >= ${rule.minWeightedCaseQuality}`);
  if (rule.minConsistencyIndex != null) {
    console.log(`    consistencyIndex >= ${rule.minConsistencyIndex}`);
  }
  if (rule.minTransparencyRatioRaw != null) {
    console.log(`    transparencyRatioRaw >= ${toFixedSmart(rule.minTransparencyRatioRaw, 2)}`);
  }
}

function printDataset(name: string, casesWithReports: CaseWithReportForCert[], result = evaluateCertification(casesWithReports)): void {
  const m = result.metrics;
  const sep = "────────────────────────────────────────────────────────";
  console.log(`\n${sep}`);
  console.log(name);
  console.log(sep);

  // --- Input summary ---
  const totalCases = casesWithReports.length;
  const completed = m.completedAttributableCaseCount;
  const eligible = m.eligiblePublicCaseCount;
  const perCase = casesWithReports.map((cw) => {
    const eligibleCase = isCaseEligible(cw.case, cw.latestReportSummary).eligible;
    const overall = getEngineOverallScore(cw.latestReportSummary);
    const confidence = getEngineConfidence(cw.latestReportSummary);
    const integrity = getEngineIntegrity(cw.latestReportSummary);
    const isPublic = cw.case.audit_mode === "public" || cw.case.visibility_scope === "public";
    return {
      id: cw.case.id,
      isPublic,
      status: cw.case.status ?? "—",
      eligible: eligibleCase,
      overall,
      confidence,
      integrity,
    };
  });
  const publicCount = perCase.filter((x) => x.isPublic).length;
  const privateCount = totalCases - publicCount;

  console.log("Input summary");
  console.log(`  Total cases:                 ${totalCases}`);
  console.log(`  Completed attributable cases:${completed}`);
  console.log(`  Eligible public cases:      ${eligible}`);
  console.log(`  Public cases (any status):  ${publicCount}`);
  console.log(`  Private cases (any status): ${privateCount}`);

  // Per-case engine inputs
  console.log("Per-case engine inputs (overall/confidence/integrity)");
  console.log("  id | scope | eligible | overall | confidence | integrity");
  for (const c of perCase) {
    const scope = c.isPublic ? "public" : "private";
    console.log(
      `  ${c.id} | ${scope} | ${c.eligible ? "yes" : "no"} | ${c.overall != null ? toFixedSmart(c.overall, 1) : "—"} | ${
        c.confidence != null ? toFixedSmart(c.confidence, 2) : "—"
      } | ${c.integrity != null ? toFixedSmart(c.integrity, 1) : "—"}`
    );
  }

  // --- Metric summary ---
  console.log("Metric summary (from eligible cases)");
  console.log(`  eligiblePublicCaseCount:      ${m.eligiblePublicCaseCount}`);
  console.log(`  completedAttributableCaseCount: ${m.completedAttributableCaseCount}`);
  console.log(`  weightedCaseQuality:         ${toFixedSmart(m.weightedCaseQuality, 1)}`);
  console.log(`  consistencyIndex:            ${toFixedSmart(m.consistencyIndex, 1)}`);
  console.log(`  transparencyRatioRaw:       ${toFixedSmart(m.transparencyRatioRaw, 2)}`);
  console.log(`  transparencyRatioScore:     ${toFixedSmart(m.transparencyRatioScore, 1)}`);
  console.log(`  entityCertificationScore:   ${toFixedSmart(m.entityCertificationScore, 1)}`);

  // --- Tier result ---
  console.log("Tier result");
  console.log(`  current tier: ${result.tier == null ? "No certification yet" : result.tier}`);
  console.log(`  next tier:    ${result.nextTier ?? "—"}`);
  console.log(`  progress to next tier: ${toFixedSmart(result.progressToNextTier, 1)}%`);
  printTierThresholdSnapshot(result.tier, result.nextTier);

  // --- Reasons ---
  console.log("Reasons helping");
  console.log(
    `  ${result.helpingReasons.length ? result.helpingReasons.join(" | ") : "—"}`
  );

  console.log("Reasons limiting");
  console.log(
    `  ${result.limitingReasons.length ? result.limitingReasons.join(" | ") : "—"}`
  );
  console.log(sep);
}

// --- Datasets ---

/**
 * A. Elite Gold/Platinum candidate
 * Expected: strong ECS, Gold or Platinum depending on count (6→Gold, 12→Platinum potential).
 */
function datasetEliteGoldPlatinum(): CaseWithReportForCert[] {
  const n = 10;
  return Array.from({ length: n }, (_, i) =>
    mockCaseWithReport({
      performance_score: 86 + (i % 4),
      confidence_multiplier: 0.82 + i * 0.01,
      documentation_integrity: 85 + (i % 5),
    })
  );
}

/**
 * B. High-volume but average quality
 * Expected: may reach Silver; should not easily reach Gold/Platinum.
 */
function datasetHighVolumeAverageQuality(): CaseWithReportForCert[] {
  const n = 12;
  return Array.from({ length: n }, (_, i) =>
    mockCaseWithReport({
      performance_score: 62 + (i % 12),
      confidence_multiplier: 0.62 + (i % 5) * 0.02,
      documentation_integrity: 65 + (i % 8),
    })
  );
}

/**
 * C. Cherry-picked transparency weakness
 * Many completed attributable cases; only a small subset are public eligible strong cases.
 * Public cases still pass confidence/integrity gates, but have average confidence below Platinum transparency threshold.
 *
 * Expected:
 * low transparency ratio (below 0.75) reduces ECS
 * Platinum blocked by transparency threshold (and likely ECS), not by eligibility gate failure
 */
function datasetCherryPickedTransparency(): CaseWithReportForCert[] {
  const completedNotPublicCount = 12;
  const publicEligibleCount = 12;

  const privateCompleted = Array.from({ length: completedNotPublicCount }, (_, i) =>
    mockCaseWithReport(
      { performance_score: 92, confidence_multiplier: 0.85, documentation_integrity: 90 },
      { id: `private-${i}`, audit_mode: "internal", status: "complete" }
    )
  );

  // Public cases: strong quality + confidence/integrity pass gates, but transparency (avg confidence) below 0.75
  const publicStrongButLowTransparency = Array.from({ length: publicEligibleCount }, (_, i) => {
    const performance_score = 90 + (i % 3); // tight variance -> high consistency
    const confidence_multiplier = 0.67 + (i % 6) * 0.01; // range ~0.67..0.72 (avg < 0.75)
    const documentation_integrity = 86 + (i % 5); // high DI
    return mockCaseWithReport(
      { performance_score, confidence_multiplier, documentation_integrity },
      { id: `public-${i}`, audit_mode: "public", status: "complete" }
    );
  });

  return [...privateCompleted, ...publicStrongButLowTransparency];
}

/**
 * D. Borderline Silver
 * Exactly 3 eligible public cases, ECS and quality near thresholds.
 * Expected: useful for threshold behavior around Silver (3 cases, ECS ≥ 70, quality ≥ 68).
 */
function datasetBorderlineSilver(): CaseWithReportForCert[] {
  return [
    mockCaseWithReport({ performance_score: 72, confidence_multiplier: 0.7, documentation_integrity: 70 }),
    mockCaseWithReport({ performance_score: 71, confidence_multiplier: 0.68, documentation_integrity: 69 }),
    mockCaseWithReport({ performance_score: 70, confidence_multiplier: 0.65, documentation_integrity: 68 }),
  ];
}

/**
 * E. Borderline Gold failure on consistency
 * Enough eligible cases (6), good average quality and ECS for Gold, but high variance so consistencyIndex < 78.
 * Expected: consistencyIndex holds back Gold (needs ≥ 78). Range 48 → index ~76.
 */
function datasetBorderlineGoldFailureConsistency(): CaseWithReportForCert[] {
  return [
    mockCaseWithReport({ performance_score: 92, confidence_multiplier: 0.82, documentation_integrity: 88 }),
    mockCaseWithReport({ performance_score: 90, confidence_multiplier: 0.8, documentation_integrity: 86 }),
    mockCaseWithReport({ performance_score: 88, confidence_multiplier: 0.78, documentation_integrity: 84 }),
    mockCaseWithReport({ performance_score: 86, confidence_multiplier: 0.76, documentation_integrity: 82 }),
    mockCaseWithReport({ performance_score: 84, confidence_multiplier: 0.74, documentation_integrity: 80 }),
    mockCaseWithReport({ performance_score: 44, confidence_multiplier: 0.65, documentation_integrity: 70 }),
  ];
}

/**
 * F. Ineligible / weak data
 * Missing score, or confidence/integrity below gate; demo/invalid where shape supports.
 * Expected: low or zero eligible public case count; no meaningful tier progression.
 */
function datasetIneligibleWeak(): CaseWithReportForCert[] {
  const noScore = mockCaseWithReport(
    {},
    { id: "no-score" }
  );
  (noScore.latestReportSummary as ReportSummaryForCert).forensic_audit!.overall_scores_v1 = {
    confidence_multiplier: 0.7,
  };

  const lowConfidence = mockCaseWithReport(
    { performance_score: 80, confidence_multiplier: 0.5, documentation_integrity: 75 },
    { id: "low-conf" }
  );

  const lowIntegrity = mockCaseWithReport(
    { performance_score: 80, confidence_multiplier: 0.75, documentation_integrity: 50 },
    { id: "low-di" }
  );

  const demoCase = mockCaseWithReport(
    { performance_score: 90, confidence_multiplier: 0.9, documentation_integrity: 90 },
    { id: "demo", is_demo: true }
  );

  const invalidCase = mockCaseWithReport(
    { performance_score: 85, confidence_multiplier: 0.8, documentation_integrity: 85 },
    { id: "invalid", is_invalid: true }
  );

  const privateCase = mockCaseWithReport(
    { performance_score: 88, confidence_multiplier: 0.85, documentation_integrity: 88 },
    { id: "private", audit_mode: "internal" }
  );

  return [noScore, lowConfidence, lowIntegrity, demoCase, invalidCase, privateCase];
}

/**
 * G. Platinum candidate with excellent quality but weak transparency
 * Expected:
 * Gold at best (ECS < 90 and transparency below 0.75)
 * Platinum blocked by transparency threshold, not by gate failure
 */
function datasetPlatinumExcellentQualityWeakTransparency(): CaseWithReportForCert[] {
  const n = 12;
  return Array.from({ length: n }, (_, i) => {
    const performance_score = 95 - (i % 3); // 93..95
    const confidence_multiplier = 0.74; // below Platinum transparency threshold 0.75, but above eligibility gate 0.60
    const documentation_integrity = 92 + (i % 3); // 92..94
    return mockCaseWithReport(
      { performance_score, confidence_multiplier, documentation_integrity },
      { id: `g-public-${i}`, audit_mode: "public", status: "complete" }
    );
  });
}

// --- Run ---

function main(): void {
  console.log("\n========== Certification engine test harness (read-only) ==========\n");

  const datasets: Array<{ name: string; build: () => CaseWithReportForCert[] }> = [
    { name: "A. Elite Gold/Platinum candidate", build: datasetEliteGoldPlatinum },
    { name: "B. High-volume average quality", build: datasetHighVolumeAverageQuality },
    { name: "C. Cherry-picked transparency weakness", build: datasetCherryPickedTransparency },
    { name: "D. Borderline Silver", build: datasetBorderlineSilver },
    { name: "E. Borderline Gold failure on consistency", build: datasetBorderlineGoldFailureConsistency },
    { name: "F. Ineligible / weak data", build: datasetIneligibleWeak },
    { name: "G. Platinum-quality but weak transparency", build: datasetPlatinumExcellentQualityWeakTransparency },
  ];

  for (const { name, build } of datasets) {
    caseIdCounter = 0;
    const casesWithReports = build();
    printDataset(name, casesWithReports);
  }

  console.log("\n========== Harness complete ==========\n");
}

main();
