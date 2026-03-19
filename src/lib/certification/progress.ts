/**
 * Progress to next tier and helping/limiting reasons.
 */

import { CERTIFICATION_TIER_RULES, TIER_ORDER } from "./constants";
import type { CertificationTierKey } from "./types";
import type { CertificationMetrics } from "./types";
import { getTierFromMetrics, getNextTierKey } from "./tier";

export function computeProgressToNextTier(
  currentTier: CertificationTierKey,
  metrics: CertificationMetrics
): number {
  const next = getNextTierKey(currentTier);
  if (!next) return 100;

  const rule = CERTIFICATION_TIER_RULES[next];
  const {
    eligiblePublicCaseCount,
    entityCertificationScore,
    weightedCaseQuality,
    consistencyIndex,
    transparencyRatioRaw,
  } = metrics;

  const caseProgress =
    rule.minEligiblePublicCases > 0
      ? Math.min(100, (eligiblePublicCaseCount / rule.minEligiblePublicCases) * 100)
      : 100;
  const scoreProgress =
    rule.minEntityCertificationScore > 0
      ? Math.min(100, (entityCertificationScore / rule.minEntityCertificationScore) * 100)
      : 100;
  const qualityProgress =
    rule.minWeightedCaseQuality > 0
      ? Math.min(100, (weightedCaseQuality / rule.minWeightedCaseQuality) * 100)
      : 100;
  const consistencyProgress =
    rule.minConsistencyIndex != null
      ? Math.min(100, (consistencyIndex / rule.minConsistencyIndex) * 100)
      : 100;
  const transparencyProgress =
    rule.minTransparencyRatioRaw != null && rule.minTransparencyRatioRaw > 0
      ? Math.min(100, (transparencyRatioRaw / rule.minTransparencyRatioRaw) * 100)
      : 100;

  const components = [caseProgress, scoreProgress, qualityProgress];
  if (rule.minConsistencyIndex != null) components.push(consistencyProgress);
  if (rule.minTransparencyRatioRaw != null) components.push(transparencyProgress);
  const progress = components.length ? components.reduce((a, b) => a + b, 0) / components.length : 0;
  return Math.round(Math.min(100, Math.max(0, progress)) * 10) / 10;
}

const TIER_LABELS: Record<CertificationTierKey, string> = {
  VERIFIED: "Active",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

export function getHelpingReasons(
  currentTier: CertificationTierKey,
  metrics: CertificationMetrics
): string[] {
  const reasons: string[] = [];
  if (metrics.eligiblePublicCaseCount >= 1) {
    reasons.push(`${metrics.eligiblePublicCaseCount} eligible public case(s) contributing`);
  }
  if (metrics.entityCertificationScore >= 70) {
    reasons.push(`Certification score ${metrics.entityCertificationScore.toFixed(1)}`);
  }
  if (metrics.weightedCaseQuality >= 68) {
    reasons.push(`Weighted case quality ${metrics.weightedCaseQuality.toFixed(1)}`);
  }
  if (metrics.consistencyIndex >= 78) {
    reasons.push(`Consistency index ${metrics.consistencyIndex.toFixed(1)}`);
  }
  if (metrics.transparencyRatioRaw >= 0.6) {
    reasons.push(`Transparency ratio ${(metrics.transparencyRatioRaw * 100).toFixed(0)}%`);
  }
  return reasons.slice(0, 3);
}

export function getLimitingReasons(
  currentTier: CertificationTierKey,
  metrics: CertificationMetrics
): string[] {
  const next = getNextTierKey(currentTier);
  const reasons: string[] = [];
  if (!next) return reasons;

  const rule = CERTIFICATION_TIER_RULES[next];
  if (metrics.eligiblePublicCaseCount < rule.minEligiblePublicCases) {
    reasons.push(
      `Need ${rule.minEligiblePublicCases} eligible public cases (have ${metrics.eligiblePublicCaseCount})`
    );
  }
  if (metrics.entityCertificationScore < rule.minEntityCertificationScore) {
    reasons.push(
      `ECS ${metrics.entityCertificationScore.toFixed(1)} below ${rule.minEntityCertificationScore} for ${TIER_LABELS[next]}`
    );
  }
  if (metrics.weightedCaseQuality < rule.minWeightedCaseQuality) {
    reasons.push(
      `Weighted quality ${metrics.weightedCaseQuality.toFixed(1)} below ${rule.minWeightedCaseQuality}`
    );
  }
  if (
    rule.minConsistencyIndex != null &&
    metrics.consistencyIndex < rule.minConsistencyIndex
  ) {
    reasons.push(
      `Consistency ${metrics.consistencyIndex.toFixed(1)} below ${rule.minConsistencyIndex}`
    );
  }
  if (
    rule.minTransparencyRatioRaw != null &&
    metrics.transparencyRatioRaw < rule.minTransparencyRatioRaw
  ) {
    reasons.push(
      `Transparency ratio ${(metrics.transparencyRatioRaw * 100).toFixed(0)}% below ${(rule.minTransparencyRatioRaw * 100).toFixed(0)}%`
    );
  }
  return reasons.slice(0, 3);
}
