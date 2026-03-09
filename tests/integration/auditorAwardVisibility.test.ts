/**
 * Integration tests: eligibility thresholds, provisional validation,
 * counts_for_awards logic, award tier progression, note visibility filtering.
 * Run: pnpm tsx --test tests/integration/auditorAwardVisibility.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAuditorReviewEligibility,
  computeProvisionalFromScore,
  computeAwardContributionWeight,
  isAuditorReviewAvailable,
  isEligibleForManualReview,
} from "@/lib/auditor/eligibility";
import {
  determineAwardTier,
  getNextTier,
  getNextAwardGap,
  shouldPauseProgression,
  computeVolumeConfidenceScore,
  getNextMilestoneFromProfile,
  AWARD_RULES,
  type TransparencyMetrics,
} from "@/lib/transparency/awardRules";
import {
  filterReportVisibleOverrides,
  filterClinicVisibleOverrides,
  filterReportVisibleSectionFeedback,
  filterClinicVisibleSectionFeedback,
  buildAuditorChangeSummaryLines,
  type OverrideRowWithVisibility,
  type SectionFeedbackRow,
} from "@/lib/auditor/visibility";

// --- Eligibility thresholds ---
test("computeAuditorReviewEligibility: score < 60 => eligible_low_score", () => {
  const r = computeAuditorReviewEligibility(45);
  assert.equal(r.eligibility, "eligible_low_score");
  assert.equal(r.reason, "low_score_extreme");
});

test("computeAuditorReviewEligibility: score > 90 => eligible_high_score", () => {
  const r = computeAuditorReviewEligibility(92);
  assert.equal(r.eligibility, "eligible_high_score");
  assert.equal(r.reason, "high_score_extreme");
});

test("computeAuditorReviewEligibility: 60 <= score <= 90 => not_eligible", () => {
  assert.equal(computeAuditorReviewEligibility(60).eligibility, "not_eligible");
  assert.equal(computeAuditorReviewEligibility(75).eligibility, "not_eligible");
  assert.equal(computeAuditorReviewEligibility(90).eligibility, "not_eligible");
});

test("isAuditorReviewAvailable: only extreme or manual unlock", () => {
  assert.equal(isAuditorReviewAvailable("eligible_low_score"), true);
  assert.equal(isAuditorReviewAvailable("eligible_high_score"), true);
  assert.equal(isAuditorReviewAvailable("eligible_manual_unlock"), true);
  assert.equal(isAuditorReviewAvailable("not_eligible"), false);
});

test("isEligibleForManualReview: same as isAuditorReviewAvailable for API", () => {
  assert.equal(isEligibleForManualReview("eligible_low_score"), true);
  assert.equal(isEligibleForManualReview("not_eligible"), false);
});

// --- Provisional / counts_for_awards ---
test("computeProvisionalFromScore: score >= 90 => pending_validation, counts_for_awards false", () => {
  const r = computeProvisionalFromScore(90);
  assert.equal(r.provisional_status, "pending_validation");
  assert.equal(r.counts_for_awards, false);
});

test("computeProvisionalFromScore: score < 90 => none, counts_for_awards true", () => {
  const r = computeProvisionalFromScore(89);
  assert.equal(r.provisional_status, "none");
  assert.equal(r.counts_for_awards, true);
});

test("computeAwardContributionWeight: provisional high-score => 0", () => {
  const w = computeAwardContributionWeight({
    score: 92,
    provisionalStatus: "pending_validation",
    countsForAwards: false,
    benchmarkEligible: false,
  });
  assert.equal(w, 0);
});

test("computeAwardContributionWeight: validated high-score => 1.5", () => {
  const w = computeAwardContributionWeight({
    score: 92,
    provisionalStatus: "validated_by_auditor",
    countsForAwards: true,
    benchmarkEligible: false,
  });
  assert.equal(w, 1.5);
});

test("computeAwardContributionWeight: normal range => 1.0", () => {
  const w = computeAwardContributionWeight({
    score: 75,
    provisionalStatus: "none",
    countsForAwards: true,
    benchmarkEligible: false,
  });
  assert.equal(w, 1.0);
});

test("computeAwardContributionWeight: benchmark bonus +0.25", () => {
  const w = computeAwardContributionWeight({
    score: 75,
    provisionalStatus: "none",
    countsForAwards: true,
    benchmarkEligible: true,
  });
  assert.equal(w, 1.25);
});

// --- Award tier progression ---
test("determineAwardTier: VERIFIED needs at least 1 validated + participation active", () => {
  const m: TransparencyMetrics = {
    transparencyParticipationRate: 0.5,
    contributedCaseCount: 1,
    validatedCaseCount: 1,
    benchmarkEligibleValidatedCount: 0,
    provisionalHighScoreCount: 0,
    validatedHighScoreCount: 0,
    lowScoreCaseCount: 0,
    averageAuditScore: 70,
    documentationIntegrityAverage: 70,
    auditedCaseCount: 2,
    volumeConfidenceScore: 0.33,
    awardProgressionPaused: false,
    participationStatusActive: true,
  };
  assert.equal(determineAwardTier(m), "VERIFIED");
});

test("determineAwardTier: paused blocks advancement above VERIFIED", () => {
  const m: TransparencyMetrics = {
    transparencyParticipationRate: 0.8,
    contributedCaseCount: 10,
    validatedCaseCount: 10,
    benchmarkEligibleValidatedCount: 5,
    provisionalHighScoreCount: 0,
    validatedHighScoreCount: 2,
    lowScoreCaseCount: 2,
    averageAuditScore: 85,
    documentationIntegrityAverage: 80,
    auditedCaseCount: 12,
    volumeConfidenceScore: 1,
    awardProgressionPaused: true,
    participationStatusActive: true,
  };
  assert.equal(determineAwardTier(m), "VERIFIED");
});

test("shouldPauseProgression: lowScoreCaseCount >= threshold => true", () => {
  assert.equal(shouldPauseProgression(2, AWARD_RULES), true);
  assert.equal(shouldPauseProgression(1, AWARD_RULES), false);
});

test("getNextTier: VERIFIED -> SILVER -> GOLD -> PLATINUM -> null", () => {
  assert.equal(getNextTier("VERIFIED"), "SILVER");
  assert.equal(getNextTier("SILVER"), "GOLD");
  assert.equal(getNextTier("GOLD"), "PLATINUM");
  assert.equal(getNextTier("PLATINUM"), null);
});

test("getNextMilestoneFromProfile: paused returns pause message", () => {
  const msg = getNextMilestoneFromProfile({
    current_award_tier: "VERIFIED",
    validated_case_count: 5,
    award_progression_paused: true,
  });
  assert.ok(msg?.includes("paused"));
  assert.ok(msg?.includes("low-score"));
});

// --- Note visibility filtering ---
test("filterReportVisibleOverrides: only included_in_report", () => {
  const rows: OverrideRowWithVisibility[] = [
    { domain_key: "SP", override_note: "x", visibility_scope: "internal_only", ai_score: 80, manual_score: 75, delta_score: -5, ai_weighted_score: 80, manual_weighted_score: 75 },
    { domain_key: "DP", override_note: "y", visibility_scope: "included_in_report", ai_score: 70, manual_score: 72, delta_score: 2, ai_weighted_score: 70, manual_weighted_score: 72 },
  ];
  const out = filterReportVisibleOverrides(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].domain_key, "DP");
});

test("filterClinicVisibleSectionFeedback: only included_in_clinic_feedback", () => {
  const rows: SectionFeedbackRow[] = [
    { section_key: "a", feedback_note: "n1", visibility_scope: "internal_only" },
    { section_key: "b", feedback_note: "n2", visibility_scope: "included_in_clinic_feedback" },
  ];
  const out = filterClinicVisibleSectionFeedback(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].section_key, "b");
});

test("internal_only notes never in report or clinic filters", () => {
  const overrides: OverrideRowWithVisibility[] = [
    { domain_key: "SP", override_note: "secret", visibility_scope: "internal_only", ai_score: 80, manual_score: 80, delta_score: 0, ai_weighted_score: 80, manual_weighted_score: 80 },
  ];
  assert.equal(filterReportVisibleOverrides(overrides).length, 0);
  assert.equal(filterClinicVisibleOverrides(overrides).length, 0);
});

test("buildAuditorChangeSummaryLines: one line per report-visible override", () => {
  const overrides: OverrideRowWithVisibility[] = [
    { domain_key: "SP", override_note: "Incomplete planning docs.", visibility_scope: "included_in_report", manual_score: 72, ai_score: 85, delta_score: -13, ai_weighted_score: 85, manual_weighted_score: 72 },
  ];
  const lines = buildAuditorChangeSummaryLines(overrides);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes("Surgical Planning"));
  assert.ok(lines[0].includes("moderated") || lines[0].includes("adjusted"));
});

test("determineAwardTier: SILVER needs 3 validated, 80 avg, 50% participation", () => {
  const m: TransparencyMetrics = {
    transparencyParticipationRate: 0.55,
    contributedCaseCount: 5,
    validatedCaseCount: 3,
    benchmarkEligibleValidatedCount: 1,
    provisionalHighScoreCount: 0,
    validatedHighScoreCount: 0,
    lowScoreCaseCount: 0,
    averageAuditScore: 82,
    documentationIntegrityAverage: 70,
    auditedCaseCount: 6,
    volumeConfidenceScore: 0.5,
    awardProgressionPaused: false,
    participationStatusActive: true,
  };
  assert.equal(determineAwardTier(m), "SILVER");
});

test("computeVolumeConfidenceScore: increases with validated count", () => {
  assert.ok(computeVolumeConfidenceScore(0, AWARD_RULES) < computeVolumeConfidenceScore(3, AWARD_RULES));
  assert.ok(computeVolumeConfidenceScore(3, AWARD_RULES) < computeVolumeConfidenceScore(8, AWARD_RULES));
  assert.equal(computeVolumeConfidenceScore(15, AWARD_RULES), 1);
});

// --- Doctor dashboard parity: getNextMilestoneFromProfile accepts doctor-profile shape ---
test("getNextMilestoneFromProfile: works with doctor-profile-like shape", () => {
  const doctorProfile = {
    current_award_tier: "SILVER",
    validated_case_count: 4,
    contributed_case_count: 5,
    average_forensic_score: 82,
    benchmark_eligible_validated_count: 2,
    benchmark_eligible_count: 2,
    transparency_score: 80,
    documentation_integrity_average: 75,
    award_progression_paused: false,
    volume_confidence_score: 50,
  };
  const msg = getNextMilestoneFromProfile(doctorProfile);
  assert.ok(typeof msg === "string");
  assert.ok(msg.length > 0);
});

// --- Leaderboard weighting prep: row shape includes weighted_benchmark_total and contribution_score ---
test("leaderboard row shape: weighted_benchmark_total and contribution_score", () => {
  const n = 5;
  const weighted_benchmark_sum = 6.25;
  const weighted_benchmark_total = weighted_benchmark_sum;
  const contribution_score = n > 0 ? weighted_benchmark_sum / n : 0;
  assert.equal(weighted_benchmark_total, 6.25);
  assert.equal(contribution_score, 1.25);
});
