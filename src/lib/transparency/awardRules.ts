export type AwardTier = "VERIFIED" | "SILVER" | "GOLD" | "PLATINUM";

export type TransparencyMetrics = {
  transparencyParticipationRate: number;
  contributedCaseCount: number;
  benchmarkEligibleCount: number;
  averageAuditScore: number;
  documentationIntegrityAverage: number;
  auditedCaseCount: number;
};

type TierRule = {
  tier: AwardTier;
  minParticipationRate: number;
  minContributedCases: number;
  minBenchmarkEligibleCases: number;
  minAverageAuditScore: number;
  minDocumentationIntegrityAverage: number;
  minAuditedCaseVolume: number;
};

export type AwardRuleConfig = {
  tiers: TierRule[];
};

// Centralized award rule scaffolding; tune thresholds in one place.
export const TRANSPARENCY_AWARD_RULES: AwardRuleConfig = {
  tiers: [
    {
      tier: "PLATINUM",
      minParticipationRate: 0.9,
      minContributedCases: 40,
      minBenchmarkEligibleCases: 20,
      minAverageAuditScore: 85,
      minDocumentationIntegrityAverage: 85,
      minAuditedCaseVolume: 45,
    },
    {
      tier: "GOLD",
      minParticipationRate: 0.75,
      minContributedCases: 20,
      minBenchmarkEligibleCases: 10,
      minAverageAuditScore: 78,
      minDocumentationIntegrityAverage: 75,
      minAuditedCaseVolume: 24,
    },
    {
      tier: "SILVER",
      minParticipationRate: 0.55,
      minContributedCases: 10,
      minBenchmarkEligibleCases: 4,
      minAverageAuditScore: 70,
      minDocumentationIntegrityAverage: 68,
      minAuditedCaseVolume: 12,
    },
    {
      tier: "VERIFIED",
      minParticipationRate: 0,
      minContributedCases: 1,
      minBenchmarkEligibleCases: 0,
      minAverageAuditScore: 0,
      minDocumentationIntegrityAverage: 0,
      minAuditedCaseVolume: 1,
    },
  ],
};

function passesRule(metrics: TransparencyMetrics, rule: TierRule): boolean {
  return (
    metrics.transparencyParticipationRate >= rule.minParticipationRate &&
    metrics.contributedCaseCount >= rule.minContributedCases &&
    metrics.benchmarkEligibleCount >= rule.minBenchmarkEligibleCases &&
    metrics.averageAuditScore >= rule.minAverageAuditScore &&
    metrics.documentationIntegrityAverage >= rule.minDocumentationIntegrityAverage &&
    metrics.auditedCaseCount >= rule.minAuditedCaseVolume
  );
}

export function determineAwardTier(
  metrics: TransparencyMetrics,
  config: AwardRuleConfig = TRANSPARENCY_AWARD_RULES
): AwardTier {
  for (const rule of config.tiers) {
    if (passesRule(metrics, rule)) return rule.tier;
  }
  return "VERIFIED";
}
