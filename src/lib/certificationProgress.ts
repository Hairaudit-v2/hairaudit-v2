/**
 * Temporary certification progress logic based on case count only.
 * No schema; uses existing case data. Isolated for future replacement by full scoring.
 */

export const CERTIFICATION_TIERS = ["Active", "Silver", "Gold", "Platinum"] as const;
export type CertificationTier = (typeof CERTIFICATION_TIERS)[number];

/** Minimum submitted case count per tier (temporary thresholds). */
export const CERTIFICATION_THRESHOLDS: Record<CertificationTier, number> = {
  Active: 1,
  Silver: 3,
  Gold: 5,
  Platinum: 10,
};

export type CertificationProgress = {
  currentTier: CertificationTier | null;
  nextTier: CertificationTier | null;
  currentCount: number;
  nextTierThreshold: number | null;
  progressPct: number;
  casesToNext: number | null;
  guidanceText: string;
};

/**
 * Compute certification progress from submitted case count.
 * Uses temporary tier thresholds only; no schema or badge changes.
 */
export function getCertificationProgress(submittedCaseCount: number): CertificationProgress {
  const count = Math.max(0, Math.floor(submittedCaseCount));
  const tiers = CERTIFICATION_TIERS;
  const thresholds = CERTIFICATION_THRESHOLDS;

  let currentTier: CertificationTier | null = null;
  let nextTier: CertificationTier | null = null;
  let nextTierThreshold: number | null = null;

  for (let i = tiers.length - 1; i >= 0; i--) {
    const tier = tiers[i];
    const threshold = thresholds[tier];
    if (count >= threshold) {
      currentTier = tier;
      if (i < tiers.length - 1) {
        nextTier = tiers[i + 1];
        nextTierThreshold = thresholds[nextTier];
      }
      break;
    }
  }
  if (currentTier === null) {
    nextTier = "Active";
    nextTierThreshold = 1;
  }

  let progressPct = 0;
  let casesToNext: number | null = nextTierThreshold != null ? Math.max(0, nextTierThreshold - count) : null;
  if (nextTierThreshold != null && nextTierThreshold > 0) {
    progressPct = Math.min(100, Math.round((count / nextTierThreshold) * 100));
  } else if (currentTier === "Platinum") {
    progressPct = 100;
  }

  let guidanceText: string;
  if (nextTier == null) {
    guidanceText = "You've reached the top certification tier. Keep building your verified record.";
  } else if (casesToNext !== null && casesToNext > 0) {
    guidanceText = `Submit ${casesToNext} more case${casesToNext === 1 ? "" : "s"} to reach ${nextTier}.`;
  } else {
    guidanceText = `Submit your first case to reach ${nextTier}.`;
  }

  return {
    currentTier,
    nextTier,
    currentCount: count,
    nextTierThreshold,
    progressPct,
    casesToNext,
    guidanceText,
  };
}
