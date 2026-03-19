/**
 * Evaluate certification for an entity (clinic or doctor) from cases with report summaries.
 * Single entry point for the certification engine.
 */

import { CERTIFICATION_TIER_RULES } from "./constants";
import type { CaseWithReportForCert, CertificationResult, CertificationTierKey } from "./types";
import { computeCertificationMetrics } from "./metrics";
import { getTierFromMetrics, getNextTierKey } from "./tier";
import {
  computeProgressToNextTier,
  getHelpingReasons,
  getLimitingReasons,
} from "./progress";

/** Display labels for tiers (matches existing CertificationProgress card). */
const TIER_TO_LABEL: Record<CertificationTierKey, string> = {
  VERIFIED: "Active",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

/**
 * Evaluate certification tier, score, progress, and reasons from cases + latest report summaries.
 * Use this on the server with data from existing case/profile queries (plus latest report per case).
 */
export function evaluateCertification(
  casesWithReports: CaseWithReportForCert[]
): CertificationResult {
  const metrics = computeCertificationMetrics(casesWithReports);
  const tier = getTierFromMetrics(metrics);
  const nextTier = getNextTierKey(tier);
  const progressToNextTier = computeProgressToNextTier(tier, metrics);
  const helpingReasons = getHelpingReasons(tier, metrics);
  const limitingReasons = getLimitingReasons(tier, metrics);

  return {
    tier,
    score: metrics.entityCertificationScore,
    metrics,
    progressToNextTier,
    nextTier,
    helpingReasons,
    limitingReasons,
  };
}

/**
 * Map CertificationResult to the legacy CertificationProgress shape for the existing card.
 * Use when feeding the dashboard card that accepts CertificationProgress.
 */
export function certificationResultToProgress(result: CertificationResult): {
  currentTier: string;
  nextTier: string | null;
  currentCount: number;
  nextTierThreshold: number | null;
  progressPct: number;
  casesToNext: number | null;
  guidanceText: string;
} {
  const next = result.nextTier;
  const nextThreshold =
    next != null ? CERTIFICATION_TIER_RULES[next].minEligiblePublicCases : null;
  const casesToNext =
    nextThreshold != null
      ? Math.max(0, nextThreshold - result.metrics.eligiblePublicCaseCount)
      : null;
  const guidanceText =
    result.helpingReasons.length > 0
      ? result.helpingReasons[0]
      : result.limitingReasons.length > 0
        ? result.limitingReasons[0]
        : next
          ? `Add more eligible public cases to reach ${TIER_TO_LABEL[next]}.`
          : "You've reached the top certification tier. Keep building your verified record.";

  return {
    currentTier: TIER_TO_LABEL[result.tier],
    nextTier: result.nextTier != null ? TIER_TO_LABEL[result.nextTier] : null,
    currentCount: result.metrics.eligiblePublicCaseCount,
    nextTierThreshold: nextThreshold,
    progressPct: result.progressToNextTier,
    casesToNext,
    guidanceText,
  };
}
