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

/** Limiting reasons when there are no eligible public cases yet. */
const ZERO_ELIGIBLE_LIMITING_REASONS: string[] = [
  "No eligible public cases yet.",
  "Submit your first eligible public case to begin certification.",
];

/**
 * Evaluate certification tier, score, progress, and reasons from cases + latest report summaries.
 * Use this on the server with data from existing case/profile queries (plus latest report per case).
 * When eligiblePublicCaseCount < 1, returns tier null and nextTier VERIFIED with clear limiting reasons.
 */
export function evaluateCertification(
  casesWithReports: CaseWithReportForCert[]
): CertificationResult {
  const metrics = computeCertificationMetrics(casesWithReports);

  if (metrics.eligiblePublicCaseCount < 1) {
    return {
      tier: null,
      score: 0,
      metrics,
      progressToNextTier: 0,
      nextTier: "VERIFIED",
      helpingReasons: [],
      limitingReasons: [...ZERO_ELIGIBLE_LIMITING_REASONS],
    };
  }

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

/** Guidance when there is no certification tier yet. */
const NO_TIER_GUIDANCE = "Submit your first eligible public case to begin certification.";

/**
 * Display-safe progress cap: when next tier is not yet achieved and hard requirements are unmet,
 * cap displayed progress at 95% so it does not appear misleadingly close to completion.
 * Core ECS/metrics are unchanged; this is presentation only.
 */
function displayProgressPct(result: CertificationResult): number {
  const raw = result.progressToNextTier;
  if (result.tier == null) return 0;
  if (result.nextTier == null) return 100;
  if (result.limitingReasons.length === 0) return raw;
  return Math.min(raw, 95);
}

/**
 * Map CertificationResult to the legacy CertificationProgress shape for the existing card.
 * Use when feeding the dashboard card that accepts CertificationProgress.
 * Zero-eligible entities get currentTier null and early-state guidance text.
 */
export function certificationResultToProgress(result: CertificationResult): {
  currentTier: string | null;
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

  if (result.tier == null) {
    return {
      currentTier: null,
      nextTier: "Active",
      currentCount: 0,
      nextTierThreshold: 1,
      progressPct: 0,
      casesToNext: 1,
      guidanceText: NO_TIER_GUIDANCE,
    };
  }

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
    progressPct: displayProgressPct(result),
    casesToNext,
    guidanceText,
  };
}
