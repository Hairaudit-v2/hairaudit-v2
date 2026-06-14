import type {
  AuditOsDomainScore,
  AuditOsHumanOverrideSummary,
  AuditOsRubricVersion,
  AuditOsScoringOutput,
  AuditOsScoringProvenance,
} from "./types";

const DEFAULT_PROVENANCE: AuditOsScoringProvenance = {
  scoringEngineVersion: "hairaudit.scoring_engine.v1",
  rubricVersion: "hairaudit.rubric.unknown",
  evidenceManifestVersion: "hairaudit.evidence_manifest.v1",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

/**
 * Extract domain rows from common legacy shapes: `domain_scores_v1.domains`, `forensic_audit.domain_scores_v1.domains`.
 */
function collectDomainScores(summary: Record<string, unknown>): AuditOsDomainScore[] {
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const d1 = forensic?.domain_scores_v1;
  const d2 = summary.domain_scores_v1;
  const block = isRecord(d1) ? d1 : isRecord(d2) ? d2 : null;
  const domains = block && Array.isArray(block.domains) ? (block.domains as unknown[]) : [];

  const out: AuditOsDomainScore[] = [];
  for (const row of domains) {
    if (!isRecord(row)) continue;
    const domainId = strOrNull(row.domain_id ?? row.domainId);
    if (!domainId) continue;
    out.push({
      domainId,
      rawScore: numOrNull(row.raw_score ?? row.rawScore),
      weightedScore: numOrNull(row.weighted_score ?? row.weightedScore),
      confidence: numOrNull(row.confidence),
      evidenceGrade: strOrNull(row.evidence_grade ?? row.evidenceGrade),
      metadata: { ...row },
    });
  }
  return out;
}

function overallFromSummary(summary: Record<string, unknown>): number | null {
  const direct = numOrNull(summary.overall_score ?? summary.score);
  if (direct !== null) return direct;
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  if (!forensic) return null;
  const overallBlock = isRecord(forensic.overall_scores_v1) ? forensic.overall_scores_v1 : null;
  const perf = numOrNull(overallBlock?.performance_score);
  if (perf !== null) return perf;
  return numOrNull(forensic.overall_score);
}

function gradeFromSummary(summary: Record<string, unknown>): string | null {
  const g = strOrNull(summary.grade);
  if (g) return g;
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  if (!forensic) return null;
  return strOrNull(forensic.grade);
}

function confidenceFromSummary(summary: Record<string, unknown>): number | string | null {
  const c = summary.confidence;
  if (typeof c === "string") return c;
  const n = numOrNull(c);
  if (n !== null) return n;
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  if (!forensic) return null;
  const fc = forensic.confidence;
  if (typeof fc === "string") return fc;
  return numOrNull(fc);
}

function confidenceLabelFromSummary(summary: Record<string, unknown>): string | null {
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  if (!forensic) return null;
  const overall = isRecord(forensic.overall_scores_v1) ? forensic.overall_scores_v1 : null;
  return strOrNull(overall?.confidence_grade ?? forensic.confidence_label);
}

function sectionScoresFromSummary(summary: Record<string, unknown>): Record<string, number | null | undefined> | undefined {
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const fromForensic = forensic?.section_scores;
  const merged: Record<string, number | null | undefined> = {};
  if (isRecord(fromForensic)) {
    for (const [k, v] of Object.entries(fromForensic)) {
      merged[k] = numOrNull(v) ?? undefined;
    }
  }
  const comp = summary.computed;
  if (isRecord(comp)) {
    const cs = comp.component_scores;
    if (isRecord(cs)) {
      const domains = cs.domains;
      const sections = cs.sections;
      if (isRecord(domains)) {
        for (const [k, v] of Object.entries(domains)) merged[`domain:${k}`] = numOrNull(v) ?? undefined;
      }
      if (isRecord(sections)) {
        for (const [k, v] of Object.entries(sections)) merged[`section:${k}`] = numOrNull(v) ?? undefined;
      }
    }
  }
  const area = summary.area_scores;
  const sec = summary.section_scores;
  if (isRecord(area)) {
    for (const [k, v] of Object.entries(area)) merged[`area:${k}`] = numOrNull(v) ?? undefined;
  }
  if (isRecord(sec)) {
    for (const [k, v] of Object.entries(sec)) merged[`legacy_section:${k}`] = numOrNull(v) ?? undefined;
  }
  return Object.keys(merged).length ? merged : undefined;
}

function buildOverrideSummary(overrides: ReadonlyArray<Record<string, unknown>> | undefined): AuditOsHumanOverrideSummary | undefined {
  if (!overrides?.length) return undefined;
  const keys = overrides
    .map((r) => strOrNull(r.domain_key ?? r.domainKey))
    .filter((k): k is string => Boolean(k));
  return {
    hasOverrides: true,
    overriddenDomainKeys: [...new Set(keys)],
    overrideRowCount: overrides.length,
    metadata: {},
  };
}

/**
 * Map a legacy HairAudit summary (and optional DB override rows) into `AuditOsScoringOutput`.
 * Tolerant of missing sections; never throws on optional fields.
 */
export function adaptExistingAuditScore(
  legacySummary: unknown,
  options?: {
    /** Optional `audit_score_overrides` rows for human override summary only. */
    overrideRows?: ReadonlyArray<Record<string, unknown>>;
    /** Preserve reference to the same object when already a plain object. */
    preserveLegacyReference?: boolean;
  }
): AuditOsScoringOutput {
  const summary = isRecord(legacySummary) ? legacySummary : {};
  const rubricBlock = isRecord(summary.rubric) ? summary.rubric : isRecord((summary.computed as Record<string, unknown> | undefined)?.rubric)
    ? ((summary.computed as Record<string, unknown>).rubric as Record<string, unknown>)
    : null;

  const rubricVersion: AuditOsRubricVersion =
    rubricBlock && typeof rubricBlock.version === "number"
      ? "hairaudit.rubric.v1"
      : "hairaudit.rubric.unknown";

  const provenance: AuditOsScoringProvenance = {
    ...DEFAULT_PROVENANCE,
    rubricVersion,
  };

  const metadata: Record<string, unknown> = {
    donor_quality: summary.donor_quality,
    graft_survival_estimate: summary.graft_survival_estimate,
    notes_present: summary.notes != null,
  };

  const domainScores = collectDomainScores(summary);
  const humanOverrides = buildOverrideSummary(options?.overrideRows);

  return {
    provenance,
    overallScore: overallFromSummary(summary),
    overallLabel: null,
    grade: gradeFromSummary(summary),
    confidence: confidenceFromSummary(summary),
    confidenceLabel: confidenceLabelFromSummary(summary),
    domainScores,
    sectionScores: sectionScoresFromSummary(summary),
    humanOverrides,
    metadata,
    rawLegacy: options?.preserveLegacyReference === false ? undefined : legacySummary,
  };
}
