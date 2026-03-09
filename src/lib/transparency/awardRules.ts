/**
 * HairAudit award progression framework — central config.
 * All thresholds live here; do not hardcode elsewhere.
 * Anti-gaming: only validated, award-counting cases contribute; low-score safeguard pauses progression.
 */

export type AwardTier = "VERIFIED" | "SILVER" | "GOLD" | "PLATINUM";

export type TransparencyMetrics = {
  /** Response rate to contribution requests (0–1) */
  transparencyParticipationRate: number;
  /** Cases where doctor/clinic contributed (request completed) */
  contributedCaseCount: number;
  /** Award-counting cases only (counts_for_awards = true) */
  validatedCaseCount: number;
  /** Among validated, benchmark-eligible */
  benchmarkEligibleValidatedCount: number;
  /** Among contributed, high-score not yet validated (provisional) */
  provisionalHighScoreCount: number;
  /** Among validated, high-score (>= 90) */
  validatedHighScoreCount: number;
  /** Among validated, score < 60 */
  lowScoreCaseCount: number;
  averageAuditScore: number;
  documentationIntegrityAverage: number;
  auditedCaseCount: number;
  /** 0–1; enough validated cases to trust the pattern */
  volumeConfidenceScore: number;
  /** When true, tier does not advance (e.g. too many low-score cases) */
  awardProgressionPaused: boolean;
  /** participation_status confirms active transparency (invited/active/high_transparency with at least 1 contributed) */
  participationStatusActive: boolean;
};

type TierRule = {
  tier: AwardTier;
  minValidatedCases: number;
  minAverageAuditScore: number;
  minBenchmarkEligibleValidated: number;
  minParticipationRate: number;
  minDocumentationIntegrity: number;
  /** Optional: e.g. consistency / stronger doc integrity for PLATINUM */
  consistencyRequired?: boolean;
};

export type AwardRuleConfig = {
  tiers: TierRule[];
  /** If validated cases with score < 60 >= this in "recent" window, progression pauses */
  lowScorePauseThreshold: number;
  /** Volume confidence: min validated cases to consider "enough" for Silver+ */
  volumeConfidenceMinValidated: number;
  /** Doc integrity "above threshold" for GOLD */
  docIntegrityThresholdGold: number;
  /** Doc integrity "stronger threshold" for PLATINUM */
  docIntegrityThresholdPlatinum: number;
};

// ——— Centralized thresholds ———
export const AWARD_RULES: AwardRuleConfig = {
  lowScorePauseThreshold: 2,
  volumeConfidenceMinValidated: 3,
  docIntegrityThresholdGold: 75,
  docIntegrityThresholdPlatinum: 85,
  tiers: [
    {
      tier: "PLATINUM",
      minValidatedCases: 15,
      minAverageAuditScore: 88,
      minBenchmarkEligibleValidated: 7,
      minParticipationRate: 0.85,
      minDocumentationIntegrity: 85,
      consistencyRequired: true,
    },
    {
      tier: "GOLD",
      minValidatedCases: 8,
      minAverageAuditScore: 85,
      minBenchmarkEligibleValidated: 3,
      minParticipationRate: 0.7,
      minDocumentationIntegrity: 75,
    },
    {
      tier: "SILVER",
      minValidatedCases: 3,
      minAverageAuditScore: 80,
      minBenchmarkEligibleValidated: 0,
      minParticipationRate: 0.5,
      minDocumentationIntegrity: 68,
    },
    {
      tier: "VERIFIED",
      minValidatedCases: 1,
      minAverageAuditScore: 0,
      minBenchmarkEligibleValidated: 0,
      minParticipationRate: 0,
      minDocumentationIntegrity: 0,
    },
  ],
};

/** VERIFIED requires at least 1 doctor/clinic-contributed case and participation_status confirms active transparency. */
function passesVerified(metrics: TransparencyMetrics): boolean {
  return metrics.validatedCaseCount >= 1 && metrics.participationStatusActive;
}

function passesRule(metrics: TransparencyMetrics, rule: TierRule, config: AwardRuleConfig): boolean {
  if (rule.tier === "VERIFIED") return passesVerified(metrics);
  if (metrics.awardProgressionPaused) return false;
  if (metrics.validatedCaseCount < rule.minValidatedCases) return false;
  if (metrics.averageAuditScore < rule.minAverageAuditScore) return false;
  if (metrics.benchmarkEligibleValidatedCount < rule.minBenchmarkEligibleValidated) return false;
  if (metrics.transparencyParticipationRate < rule.minParticipationRate) return false;
  if (metrics.documentationIntegrityAverage < rule.minDocumentationIntegrity) return false;
  if (rule.consistencyRequired && metrics.volumeConfidenceScore < 1) return false;
  return true;
}

/** Determine current award tier from metrics. When paused, returns highest tier that would still pass (no advancement). */
export function determineAwardTier(
  metrics: TransparencyMetrics,
  config: AwardRuleConfig = AWARD_RULES
): AwardTier {
  for (const rule of config.tiers) {
    if (passesRule(metrics, rule, config)) return rule.tier;
  }
  return "VERIFIED";
}

/** Next tier up from current; null if already PLATINUM. */
export function getNextTier(current: AwardTier): AwardTier | null {
  const order: AwardTier[] = ["VERIFIED", "SILVER", "GOLD", "PLATINUM"];
  const i = order.indexOf(current);
  return i < 0 || i >= order.length - 1 ? null : order[i + 1];
}

/** Human-readable gap to next tier for UI. */
export function getNextAwardGap(
  metrics: TransparencyMetrics,
  currentTier: AwardTier,
  config: AwardRuleConfig = AWARD_RULES
): string | null {
  const next = getNextTier(currentTier);
  if (!next) return null;
  if (metrics.awardProgressionPaused) {
    return `Award progression paused: ${config.lowScorePauseThreshold} or more low-score validated cases. Resolve low-score cases to resume.`;
  }
  const rule = config.tiers.find((r) => r.tier === next);
  if (!rule) return null;

  const parts: string[] = [];
  if (metrics.validatedCaseCount < rule.minValidatedCases) {
    parts.push(`${rule.minValidatedCases - metrics.validatedCaseCount} more validated award-counting case(s)`);
  }
  if (metrics.averageAuditScore < rule.minAverageAuditScore) {
    const gap = (rule.minAverageAuditScore - metrics.averageAuditScore).toFixed(1);
    parts.push(`average validated score +${gap} (need ${rule.minAverageAuditScore})`);
  }
  if (rule.minBenchmarkEligibleValidated > 0 && metrics.benchmarkEligibleValidatedCount < rule.minBenchmarkEligibleValidated) {
    parts.push(`${rule.minBenchmarkEligibleValidated - metrics.benchmarkEligibleValidatedCount} more validated benchmark-eligible case(s)`);
  }
  if (metrics.transparencyParticipationRate < rule.minParticipationRate) {
    const pct = (rule.minParticipationRate * 100).toFixed(0);
    parts.push(`participation rate ${pct}%`);
  }
  if (metrics.documentationIntegrityAverage < rule.minDocumentationIntegrity) {
    parts.push(`documentation integrity average ${rule.minDocumentationIntegrity}`);
  }
  if (rule.consistencyRequired && metrics.volumeConfidenceScore < 1) {
    parts.push("consistency requirement (volume/pattern)");
  }
  if (parts.length === 0) return null;
  return `${next}: ${parts.join("; ")}`;
}

/** Volume confidence 0–1: enough validated cases to trust the pattern. */
export function computeVolumeConfidenceScore(
  validatedCaseCount: number,
  config: AwardRuleConfig = AWARD_RULES
): number {
  const min = config.volumeConfidenceMinValidated;
  if (validatedCaseCount >= 15) return 1;
  if (validatedCaseCount >= 8) return 0.9;
  if (validatedCaseCount >= min) return Math.min(1, 0.5 + (validatedCaseCount - min) / 10);
  return validatedCaseCount / Math.max(1, min);
}

/** True when low-score validated cases (score < 60) >= threshold. */
export function shouldPauseProgression(
  lowScoreCaseCount: number,
  config: AwardRuleConfig = AWARD_RULES
): boolean {
  return lowScoreCaseCount >= config.lowScorePauseThreshold;
}

/** Build next milestone message from persisted profile fields (e.g. for clinic dashboard). */
export function getNextMilestoneFromProfile(profile: {
  current_award_tier?: string | null;
  validated_case_count?: number;
  average_forensic_score?: number;
  benchmark_eligible_validated_count?: number;
  transparency_score?: number;
  documentation_integrity_average?: number;
  award_progression_paused?: boolean;
  volume_confidence_score?: number;
}): string | null {
  const currentTier = (profile.current_award_tier ?? "VERIFIED") as AwardTier;
  const metrics: TransparencyMetrics = {
    transparencyParticipationRate: Number(profile.transparency_score ?? 0) / 100,
    contributedCaseCount: Number(profile.validated_case_count ?? 0),
    validatedCaseCount: Number(profile.validated_case_count ?? 0),
    benchmarkEligibleValidatedCount: Number(profile.benchmark_eligible_validated_count ?? 0),
    provisionalHighScoreCount: 0,
    validatedHighScoreCount: 0,
    lowScoreCaseCount: 0,
    averageAuditScore: Number(profile.average_forensic_score ?? 0),
    documentationIntegrityAverage: Number(profile.documentation_integrity_average ?? 0),
    auditedCaseCount: 0,
    volumeConfidenceScore: Number(profile.volume_confidence_score ?? 0) / 100,
    awardProgressionPaused: Boolean(profile.award_progression_paused),
    participationStatusActive: true,
  };
  return getNextAwardGap(metrics, currentTier);
}
