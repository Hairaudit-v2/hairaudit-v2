/**
 * Resolve auditor-approved domain scores.
 * When an override exists: use manual_score.
 * When no override: use AI score.
 * AI values are never overwritten; overrides stored separately.
 */

export type DomainId = "SP" | "DP" | "GV" | "IC" | "DI";

export type DomainScoreOverride = {
  domain_key: DomainId;
  ai_score: number;
  ai_weighted_score: number | null;
  manual_score: number;
  manual_weighted_score: number | null;
  delta_score: number;
};

export type ResolvedDomainScore = {
  domain_id: DomainId;
  /** Final score for display (manual if override, else AI raw) */
  final_score: number;
  /** Final weighted score (manual_weighted if override, else AI weighted) */
  final_weighted: number;
  /** Original AI score (never overwritten) */
  ai_score: number;
  ai_weighted_score: number | null;
  /** True if auditor overrode this domain */
  is_overridden: boolean;
  delta_score?: number;
};

const DOMAIN_WEIGHTS: Record<DomainId, number> = {
  SP: 15,
  DP: 25,
  GV: 20,
  IC: 25,
  DI: 15,
};

/**
 * Compute final auditor-approved overall score from domain scores.
 * Uses manual scores where overrides exist, AI scores otherwise.
 */
export function computeAuditorOverallScore(
  domains: ResolvedDomainScore[]
): { performance_score: number; benchmark_score: number; confidence_multiplier: number } {
  const byId = new Map(domains.map((d) => [d.domain_id, d]));
  const raw =
    (Number(byId.get("SP")?.final_score ?? 0) * DOMAIN_WEIGHTS.SP +
      Number(byId.get("DP")?.final_score ?? 0) * DOMAIN_WEIGHTS.DP +
      Number(byId.get("GV")?.final_score ?? 0) * DOMAIN_WEIGHTS.GV +
      Number(byId.get("IC")?.final_score ?? 0) * DOMAIN_WEIGHTS.IC +
      Number(byId.get("DI")?.final_score ?? 0) * DOMAIN_WEIGHTS.DI) /
    100;
  const performance_score = Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
  return {
    performance_score,
    benchmark_score: performance_score,
    confidence_multiplier: 1,
  };
}

/**
 * Resolve a single domain: override wins over AI.
 */
export function resolveDomainScore(
  domainId: DomainId,
  aiRaw: number,
  aiWeighted: number | null,
  override: DomainScoreOverride | null
): ResolvedDomainScore {
  if (override && override.domain_key === domainId) {
    return {
      domain_id: domainId,
      final_score: override.manual_score,
      final_weighted: override.manual_weighted_score ?? override.manual_score,
      ai_score: override.ai_score,
      ai_weighted_score: override.ai_weighted_score,
      is_overridden: true,
      delta_score: override.delta_score,
    };
  }
  return {
    domain_id: domainId,
    final_score: aiRaw,
    final_weighted: aiWeighted ?? aiRaw,
    ai_score: aiRaw,
    ai_weighted_score: aiWeighted,
    is_overridden: false,
  };
}
