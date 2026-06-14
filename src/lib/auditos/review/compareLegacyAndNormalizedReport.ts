/**
 * Stage 4D — structural comparison between legacy `reports.summary` and persisted AuditOS snapshot JSON.
 * Not clinical judgement.
 */

export type PersistedAuditOsSnapshotPayload = {
  normalized_scoring?: unknown;
  evidence_manifest?: unknown;
  normalized_report?: unknown;
} | null;

/** Extract scoring JSON whether stored top-level or nested under normalized_report.scoring. */
export function extractNormalizedScoringJsonForReview(persisted: {
  normalized_scoring?: unknown;
  normalized_report?: unknown;
} | null): unknown {
  if (!persisted) return null;
  const top = persisted.normalized_scoring;
  if (isRecord(top)) return top;
  const report = persisted.normalized_report;
  if (isRecord(report) && isRecord(report.scoring)) return report.scoring;
  return null;
}

export function persistedPayloadFromReviewBlob(blob: {
  normalizedScoring: unknown;
  evidenceManifest: unknown;
  normalizedReport: unknown;
} | null): PersistedAuditOsSnapshotPayload {
  if (!blob) return null;
  return {
    normalized_scoring: blob.normalizedScoring ?? undefined,
    evidence_manifest: blob.evidenceManifest ?? undefined,
    normalized_report: blob.normalizedReport ?? undefined,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function legacyOverallPresent(summary: Record<string, unknown>): boolean {
  if (typeof summary.score === "number" && Number.isFinite(summary.score)) return true;
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  if (!isRecord(forensic)) return false;
  const overall = isRecord(forensic.overall_scores_v1) ? forensic.overall_scores_v1 : null;
  const perf = overall?.performance_score;
  const bench = overall?.benchmark_score;
  if (typeof perf === "number" && Number.isFinite(perf)) return true;
  if (typeof bench === "number" && Number.isFinite(bench)) return true;
  const os = forensic.overall_score;
  return typeof os === "number" && Number.isFinite(os);
}

function legacyDomainCount(summary: Record<string, unknown>): number {
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const d1 = forensic && isRecord(forensic.domain_scores_v1) ? forensic.domain_scores_v1 : null;
  const d2 = isRecord(summary.domain_scores_v1) ? summary.domain_scores_v1 : null;
  const block = d1 ?? d2;
  const domains = block && Array.isArray(block.domains) ? block.domains : [];
  return domains.filter(isRecord).length;
}

function legacyFindingCount(summary: Record<string, unknown>): number {
  let n = 0;
  const raw = summary.findings;
  if (Array.isArray(raw)) n += raw.filter(isRecord).length;
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const kf = forensic && Array.isArray(forensic.key_findings) ? forensic.key_findings : [];
  n += kf.filter(isRecord).length;
  return n;
}

function legacyLimitationsPresent(summary: Record<string, unknown>): boolean {
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const dq = forensic && isRecord(forensic.data_quality) ? forensic.data_quality : null;
  const lim = dq && Array.isArray(dq.limitations) ? dq.limitations : [];
  return lim.length > 0;
}

function legacyRecommendationCount(summary: Record<string, unknown>): number {
  const narrative = summary.patient_narrative ?? summary.narrative;
  let n = 0;
  if (isRecord(narrative)) {
    const follow = narrative.follow_up_advice ?? narrative.followUpAdvice;
    if (typeof follow === "string" && follow.trim()) n += 1;
  }
  return n;
}

function normalizedScoringFromPersisted(persisted: NonNullable<PersistedAuditOsSnapshotPayload>): Record<string, unknown> | null {
  const top = persisted.normalized_scoring;
  if (isRecord(top)) return top;
  const report = persisted.normalized_report;
  if (isRecord(report) && isRecord(report.scoring)) return report.scoring as Record<string, unknown>;
  return null;
}

function normalizedReportRecord(persisted: NonNullable<PersistedAuditOsSnapshotPayload>): Record<string, unknown> | null {
  if (!isRecord(persisted.normalized_report)) return null;
  return persisted.normalized_report;
}

function normalizedEvidenceRecord(persisted: NonNullable<PersistedAuditOsSnapshotPayload>): Record<string, unknown> | null {
  if (!isRecord(persisted.evidence_manifest)) return null;
  return persisted.evidence_manifest;
}

export type LegacyVsNormalizedComparison = {
  status: "ok" | "warning" | "missing";
  metrics: {
    legacyOverallScorePresent: boolean;
    normalizedOverallScorePresent: boolean;
    legacyDomainCount: number;
    normalizedDomainCount: number;
    evidenceItemCount: number;
    missingEvidenceCount: number;
    findingSectionCount: number;
    recommendationCount: number;
    limitationsPresent: boolean;
  };
  warnings: string[];
};

export function compareLegacyAndNormalizedReport(args: {
  legacySummary: unknown;
  persistedSnapshot: PersistedAuditOsSnapshotPayload;
}): LegacyVsNormalizedComparison {
  const warnings: string[] = [];
  const summary = isRecord(args.legacySummary) ? args.legacySummary : {};

  if (!args.persistedSnapshot) {
    return {
      status: "missing",
      metrics: {
        legacyOverallScorePresent: legacyOverallPresent(summary),
        normalizedOverallScorePresent: false,
        legacyDomainCount: legacyDomainCount(summary),
        normalizedDomainCount: 0,
        evidenceItemCount: 0,
        missingEvidenceCount: 0,
        findingSectionCount: 0,
        recommendationCount: 0,
        limitationsPresent: legacyLimitationsPresent(summary),
      },
      warnings: ["no persisted AuditOS shadow snapshot for comparison"],
    };
  }

  const snap = args.persistedSnapshot;
  const scoring = normalizedScoringFromPersisted(snap);
  const report = normalizedReportRecord(snap);
  const evidence = normalizedEvidenceRecord(snap);

  const hasAnyNormalized = Boolean(scoring || report || evidence);
  if (!hasAnyNormalized) {
    warnings.push("persisted snapshot row has no normalized_scoring, normalized_report, or evidence_manifest");
    return {
      status: "missing",
      metrics: {
        legacyOverallScorePresent: legacyOverallPresent(summary),
        normalizedOverallScorePresent: false,
        legacyDomainCount: legacyDomainCount(summary),
        normalizedDomainCount: 0,
        evidenceItemCount: 0,
        missingEvidenceCount: 0,
        findingSectionCount: 0,
        recommendationCount: 0,
        limitationsPresent: legacyLimitationsPresent(summary),
      },
      warnings,
    };
  }

  const legacyOverall = legacyOverallPresent(summary);
  const normalizedOverall =
    scoring != null &&
    scoring.overallScore !== null &&
    scoring.overallScore !== undefined &&
    (typeof scoring.overallScore === "number" ? Number.isFinite(scoring.overallScore) : true);

  const legacyDomains = legacyDomainCount(summary);
  const domainScores = scoring && Array.isArray(scoring.domainScores) ? scoring.domainScores : [];
  const normalizedDomains = domainScores.filter(isRecord).length;

  const images = evidence && Array.isArray(evidence.images) ? evidence.images.length : 0;
  const documents = evidence && Array.isArray(evidence.documents) ? evidence.documents.length : 0;
  const other = evidence && Array.isArray(evidence.otherUploads) ? evidence.otherUploads.length : 0;
  const evidenceItemCount = images + documents + other;

  const missing = evidence && Array.isArray(evidence.missingEvidence) ? evidence.missingEvidence.length : 0;

  const findingsLen = report && Array.isArray(report.findings) ? report.findings.filter(isRecord).length : 0;
  const findingSectionCount = Math.max(findingsLen, legacyFindingCount(summary));

  const recs = report && Array.isArray(report.recommendations) ? report.recommendations.length : 0;
  const recommendationCount = Math.max(recs, legacyRecommendationCount(summary));

  const limNorm =
    report &&
    Array.isArray(report.limitations) &&
    (report.limitations as unknown[]).filter((x) => String(x).trim().length > 0).length > 0;
  const limitationsPresent = Boolean(limNorm || legacyLimitationsPresent(summary));

  if (legacyOverall !== Boolean(normalizedOverall)) {
    warnings.push(
      `overall score presence mismatch (legacy=${legacyOverall}, normalized=${Boolean(normalizedOverall)})`
    );
  }
  if (legacyDomains !== normalizedDomains) {
    warnings.push(`domain row count mismatch (legacy=${legacyDomains}, normalized=${normalizedDomains})`);
  }

  const status: LegacyVsNormalizedComparison["status"] = warnings.length ? "warning" : "ok";

  return {
    status,
    metrics: {
      legacyOverallScorePresent: legacyOverall,
      normalizedOverallScorePresent: Boolean(normalizedOverall),
      legacyDomainCount: legacyDomains,
      normalizedDomainCount: normalizedDomains,
      evidenceItemCount,
      missingEvidenceCount: missing,
      findingSectionCount,
      recommendationCount,
      limitationsPresent,
    },
    warnings,
  };
}
