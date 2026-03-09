/**
 * Conditional optional auditor review eligibility.
 * Review workflow is only offered for extreme scores (< 60 or > 90) or when admin manually unlocks.
 */

export type AuditorReviewEligibility =
  | "not_eligible"
  | "eligible_low_score"
  | "eligible_high_score"
  | "eligible_manual_unlock";

export type AuditorReviewStatus =
  | "not_requested"
  | "available"
  | "in_review"
  | "completed"
  | "skipped";

export type AuditorReviewReason =
  | "low_score_extreme"
  | "high_score_extreme"
  | "manual_admin_unlock";

const LOW_THRESHOLD = 60;
const HIGH_THRESHOLD = 90;

export function computeAuditorReviewEligibility(finalAiScore: number): {
  eligibility: AuditorReviewEligibility;
  status: AuditorReviewStatus;
  reason: AuditorReviewReason | null;
} {
  const score = Number(finalAiScore);
  if (!Number.isFinite(score)) {
    return { eligibility: "not_eligible", status: "not_requested", reason: null };
  }
  if (score < LOW_THRESHOLD) {
    return {
      eligibility: "eligible_low_score",
      status: "available",
      reason: "low_score_extreme",
    };
  }
  if (score > HIGH_THRESHOLD) {
    return {
      eligibility: "eligible_high_score",
      status: "available",
      reason: "high_score_extreme",
    };
  }
  return { eligibility: "not_eligible", status: "not_requested", reason: null };
}

const ELIGIBLE_FOR_MANUAL_REVIEW = ["eligible_low_score", "eligible_high_score", "eligible_manual_unlock"] as const;

/** Whether the report should show auditor review controls (extreme score or manual unlock). */
export function isAuditorReviewAvailable(
  eligibility: AuditorReviewEligibility | string | null | undefined
): boolean {
  return ELIGIBLE_FOR_MANUAL_REVIEW.includes(eligibility as (typeof ELIGIBLE_FOR_MANUAL_REVIEW)[number]);
}

/** Check eligibility for API enforcement: only eligible reports may receive overrides/feedback. */
export function isEligibleForManualReview(eligibility: string | null | undefined): boolean {
  return ELIGIBLE_FOR_MANUAL_REVIEW.includes(eligibility as (typeof ELIGIBLE_FOR_MANUAL_REVIEW)[number]);
}

/** Whether a high-score case is provisional for award contribution until validated. */
export function isProvisionalForAward(
  eligibility: AuditorReviewEligibility | string | null | undefined,
  status: AuditorReviewStatus | string | null | undefined
): boolean {
  if (eligibility !== "eligible_high_score") return false;
  return status !== "completed" && status !== "skipped";
}

/** Provisional status for high-score cases (>= 90). */
export type ProvisionalStatus =
  | "none"
  | "pending_validation"
  | "validated_by_auditor"
  | "validated_by_evidence"
  | "validated_by_consistency"
  | "rejected";

/** Compute provisional status and counts_for_awards for a new report from final AI score. */
export function computeProvisionalFromScore(finalAiScore: number): {
  provisional_status: ProvisionalStatus;
  counts_for_awards: boolean;
} {
  const score = Number(finalAiScore);
  if (!Number.isFinite(score) || score < HIGH_THRESHOLD) {
    return { provisional_status: "none", counts_for_awards: true };
  }
  return { provisional_status: "pending_validation", counts_for_awards: false };
}

/**
 * Award contribution weight:
 * - normal validated (60–89): 1.0
 * - provisional >=90 not validated: 0
 * - validated >=90: 1.5
 * - benchmark-eligible validated: bonus +0.25
 */
export function computeAwardContributionWeight(params: {
  score: number;
  provisionalStatus: ProvisionalStatus | string | null | undefined;
  countsForAwards: boolean;
  benchmarkEligible: boolean;
}): number {
  const { score, provisionalStatus, countsForAwards, benchmarkEligible } = params;
  if (!countsForAwards) return 0;
  const validated = provisionalStatus === "validated_by_auditor" || provisionalStatus === "validated_by_evidence" || provisionalStatus === "validated_by_consistency";
  const isHighScore = Number(score) > HIGH_THRESHOLD;
  let w = 1.0;
  if (isHighScore && validated) w = 1.5;
  if (benchmarkEligible) w += 0.25;
  return Math.round(w * 100) / 100;
}

/** Whether this report is high-score provisional (>=90 and not yet validated). */
export function isHighScoreProvisional(
  score: number,
  provisionalStatus: ProvisionalStatus | string | null | undefined
): boolean {
  return Number(score) >= HIGH_THRESHOLD && provisionalStatus === "pending_validation";
}

/** Whether this report is validated (counts for awards). */
export function isValidatedForAward(
  provisionalStatus: ProvisionalStatus | string | null | undefined,
  countsForAwards: boolean
): boolean {
  return Boolean(countsForAwards);
}
