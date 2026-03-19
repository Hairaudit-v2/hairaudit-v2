/**
 * Certification engine constants.
 * Tier thresholds and eligibility gates; no schema dependencies.
 */

import type { CertificationTierKey } from "./types";

/** Minimum confidence (0–1) for a case to count as eligible. */
export const ELIGIBILITY_MIN_CONFIDENCE = 0.6;

/** Minimum documentation integrity (0–100) for a case to count as eligible. */
export const ELIGIBILITY_MIN_INTEGRITY = 60;

/** Tier definitions: min eligible public cases and score/quality thresholds. */
export const CERTIFICATION_TIER_RULES: Record<
  CertificationTierKey,
  {
    minEligiblePublicCases: number;
    minEntityCertificationScore: number;
    minWeightedCaseQuality: number;
    minConsistencyIndex?: number;
    minTransparencyRatioRaw?: number;
  }
> = {
  VERIFIED: {
    minEligiblePublicCases: 1,
    minEntityCertificationScore: 0,
    minWeightedCaseQuality: 0,
  },
  SILVER: {
    minEligiblePublicCases: 3,
    minEntityCertificationScore: 70,
    minWeightedCaseQuality: 68,
  },
  GOLD: {
    minEligiblePublicCases: 6,
    minEntityCertificationScore: 80,
    minWeightedCaseQuality: 78,
    minConsistencyIndex: 78,
    minTransparencyRatioRaw: 0.6,
  },
  PLATINUM: {
    minEligiblePublicCases: 12,
    minEntityCertificationScore: 90,
    minWeightedCaseQuality: 88,
    minConsistencyIndex: 88,
    minTransparencyRatioRaw: 0.75,
  },
};

/** Order for tier progression (lowest to highest). */
export const TIER_ORDER: CertificationTierKey[] = ["VERIFIED", "SILVER", "GOLD", "PLATINUM"];
