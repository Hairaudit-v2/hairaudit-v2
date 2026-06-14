/**
 * Stage 4D — read-only domain normalization view-model from persisted AuditOS scoring JSON.
 */

const KNOWN_DOMAIN_IDS = new Set(["SP", "DP", "GV", "IC", "DI"]);

export type DomainNormalizationRow = {
  domainId: string;
  rawScore: number | null;
  weightedScore: number | null;
  confidence: number | null;
  evidenceGrade: string | null;
  legacyMetadataKeys: string[];
  hasHumanOverrideOnDomain: boolean;
};

export type DomainNormalizationViewModel = {
  domains: DomainNormalizationRow[];
  overallScore: number | null;
  grade: string | null;
  confidenceLabel: string | null;
  humanOverridesActive: boolean;
  warnings: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function buildDomainNormalizationViewModel(normalizedScoringJson: unknown): DomainNormalizationViewModel {
  const warnings: string[] = [];
  if (!isRecord(normalizedScoringJson)) {
    return {
      domains: [],
      overallScore: null,
      grade: null,
      confidenceLabel: null,
      humanOverridesActive: false,
      warnings: ["missing or invalid normalized_scoring"],
    };
  }

  const rawDomains = Array.isArray(normalizedScoringJson.domainScores)
    ? (normalizedScoringJson.domainScores as unknown[])
    : [];

  const overridden = isRecord(normalizedScoringJson.humanOverrides) ? normalizedScoringJson.humanOverrides : null;
  const overriddenKeys = new Set(
    Array.isArray(overridden?.overriddenDomainKeys)
      ? (overridden?.overriddenDomainKeys as unknown[]).map((x) => String(x))
      : []
  );
  const humanOverridesActive = Boolean(overridden?.hasOverrides);

  const domains: DomainNormalizationRow[] = [];
  for (const row of rawDomains) {
    if (!isRecord(row)) continue;
    const domainId = String(row.domainId ?? row.domain_id ?? "").trim();
    if (!domainId) {
      warnings.push("domain row without domainId skipped");
      continue;
    }
    if (!KNOWN_DOMAIN_IDS.has(domainId)) {
      warnings.push(`unrecognized domain key: ${domainId}`);
    }
    const meta = isRecord(row.metadata) ? row.metadata : null;
    const legacyMetadataKeys = meta ? Object.keys(meta).slice(0, 25) : [];
    const rawScore = numOrNull(row.rawScore ?? row.raw_score);
    const weightedScore = numOrNull(row.weightedScore ?? row.weighted_score);
    const confidence = numOrNull(row.confidence);
    const evidenceGrade =
      typeof row.evidenceGrade === "string"
        ? row.evidenceGrade
        : typeof row.evidence_grade === "string"
          ? row.evidence_grade
          : null;

    domains.push({
      domainId,
      rawScore,
      weightedScore,
      confidence,
      evidenceGrade,
      legacyMetadataKeys,
      hasHumanOverrideOnDomain: overriddenKeys.has(domainId),
    });
  }

  if (domains.length === 0) {
    warnings.push("no domainScores rows in normalized scoring");
  }

  return {
    domains,
    overallScore: numOrNull(normalizedScoringJson.overallScore),
    grade: typeof normalizedScoringJson.grade === "string" ? normalizedScoringJson.grade : null,
    confidenceLabel:
      typeof normalizedScoringJson.confidenceLabel === "string" ? normalizedScoringJson.confidenceLabel : null,
    humanOverridesActive,
    warnings,
  };
}
