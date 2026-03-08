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

/** Whether the report should show auditor review controls (extreme score or manual unlock). */
export function isAuditorReviewAvailable(
  eligibility: AuditorReviewEligibility | string | null | undefined
): boolean {
  return (
    eligibility === "eligible_low_score" ||
    eligibility === "eligible_high_score" ||
    eligibility === "eligible_manual_unlock"
  );
}

/** Whether a high-score case is provisional for award contribution until auditor review is completed. */
export function isProvisionalForAward(
  eligibility: AuditorReviewEligibility | string | null | undefined,
  status: AuditorReviewStatus | string | null | undefined
): boolean {
  if (eligibility !== "eligible_high_score") return false;
  return status !== "completed" && status !== "skipped";
}
