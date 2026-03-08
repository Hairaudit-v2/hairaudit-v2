/**
 * Apply auditor score overrides to a report summary.
 * Returns a new summary with domain scores replaced where overrides exist.
 * AI values preserved in override records; never overwrite source data.
 */

import { computeAuditorOverallScore, resolveDomainScore, type DomainScoreOverride } from "./resolveScores";

export type OverrideRow = {
  domain_key: string;
  ai_score: number;
  ai_weighted_score: number | null;
  manual_score: number;
  manual_weighted_score: number | null;
  delta_score: number;
};

export type DomainScoreV1 = {
  domain_id?: string;
  raw_score?: number;
  weighted_score?: number;
  [k: string]: unknown;
};

/**
 * Apply overrides to forensic domain_scores_v1.domains and overall_scores_v1.
 * Returns a new summary object (shallow clone) with mutated forensic branch.
 */
export function applyAuditorOverridesToSummary(
  summary: Record<string, unknown>,
  overrides: OverrideRow[]
): Record<string, unknown> {
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  if (!forensic || typeof forensic !== "object") return summary;

  const domainScores = forensic.domain_scores_v1 as { domains?: DomainScoreV1[] } | undefined;
  const domains = Array.isArray(domainScores?.domains) ? domainScores.domains : [];
  if (domains.length === 0) return summary;

  const overrideByDomain = new Map(overrides.map((o) => [o.domain_key, o]));
  const resolvedScores: ReturnType<typeof resolveDomainScore>[] = [];
  const resolved: DomainScoreV1[] = domains.map((d) => {
    const domainId = d.domain_id as string;
    const ov = overrideByDomain.get(domainId);
    const aiRaw = Number(d.raw_score ?? 0);
    const aiWeighted = d.weighted_score != null ? Number(d.weighted_score) : null;
    const overridePayload: DomainScoreOverride | null = ov
      ? {
          domain_key: domainId as "SP" | "DP" | "GV" | "IC" | "DI",
          ai_score: ov.ai_score,
          ai_weighted_score: ov.ai_weighted_score,
          manual_score: ov.manual_score,
          manual_weighted_score: ov.manual_weighted_score,
          delta_score: ov.delta_score,
        }
      : null;

    const resolvedScore = resolveDomainScore(
      domainId as "SP" | "DP" | "GV" | "IC" | "DI",
      aiRaw,
      aiWeighted,
      overridePayload
    );
    resolvedScores.push(resolvedScore);

    if (!resolvedScore.is_overridden) return d;
    return {
      ...d,
      raw_score: resolvedScore.final_score,
      weighted_score: resolvedScore.final_weighted,
    };
  });

  const { performance_score, benchmark_score } = computeAuditorOverallScore(resolvedScores);

  const nextForensic = {
    ...forensic,
    domain_scores_v1: {
      ...(forensic.domain_scores_v1 as object),
      domains: resolved,
    },
    overall_scores_v1: {
      ...(forensic.overall_scores_v1 as object),
      performance_score,
      benchmark_score,
    },
  };

  return {
    ...summary,
    forensic_audit: nextForensic,
    forensic: nextForensic,
  };
}
