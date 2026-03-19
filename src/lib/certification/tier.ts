/**
 * Certification tier determination from metrics.
 * VERIFIED → SILVER → GOLD → PLATINUM per spec thresholds.
 */

import { CERTIFICATION_TIER_RULES, TIER_ORDER } from "./constants";
import type { CertificationTierKey } from "./types";
import type { CertificationMetrics } from "./types";

export function getTierFromMetrics(metrics: CertificationMetrics): CertificationTierKey {
  const {
    eligiblePublicCaseCount,
    entityCertificationScore,
    weightedCaseQuality,
    consistencyIndex,
    transparencyRatioRaw,
  } = metrics;

  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    const rule = CERTIFICATION_TIER_RULES[tier];
    if (eligiblePublicCaseCount < rule.minEligiblePublicCases) continue;
    if (entityCertificationScore < rule.minEntityCertificationScore) continue;
    if (weightedCaseQuality < rule.minWeightedCaseQuality) continue;
    if (rule.minConsistencyIndex != null && consistencyIndex < rule.minConsistencyIndex) continue;
    if (rule.minTransparencyRatioRaw != null && transparencyRatioRaw < rule.minTransparencyRatioRaw) continue;
    return tier;
  }
  return "VERIFIED";
}

export function getNextTierKey(current: CertificationTierKey): CertificationTierKey | null {
  const idx = TIER_ORDER.indexOf(current);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}
