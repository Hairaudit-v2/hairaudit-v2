/**
 * AuditOS — versioned scoring boundary (Stage 4A).
 * Stable wire shapes for future FI / AuditOS nodes. Production scoring logic remains unchanged.
 */

/** Engine that produced normalized scores (HairAudit AI + v1 domains today). */
export type AuditOsScoringEngineVersion = "hairaudit.scoring_engine.v1";

/** Rubric / policy version carried alongside deterministic rubric scoring when present. */
export type AuditOsRubricVersion = "hairaudit.rubric.v1" | "hairaudit.rubric.unknown";

/** Evidence manifest schema version referenced from scoring context (see `auditos/evidence`). */
export type AuditOsEvidenceManifestVersion = "hairaudit.evidence_manifest.v1";

export type AuditOsScoringProvenance = {
  scoringEngineVersion: AuditOsScoringEngineVersion;
  rubricVersion?: AuditOsRubricVersion;
  evidenceManifestVersion?: AuditOsEvidenceManifestVersion;
};

/**
 * Declarative inputs for a scoring run (future use). Stage 4A: structural placeholder only.
 */
export type AuditOsScoringInput = {
  caseId: string;
  provenance: AuditOsScoringProvenance;
  /** Optional rubric identity when rubric-based scoring participates. */
  rubric?: { rubricId: string; rubricVersion: number };
  /** Free-form references to answer blobs (not full PHI payloads in FI events). */
  answerSourceRefs?: string[];
  evidenceManifestId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditOsDomainScore = {
  domainId: string;
  rawScore?: number | null;
  weightedScore?: number | null;
  confidence?: number | null;
  evidenceGrade?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditOsHumanOverrideSummary = {
  hasOverrides: boolean;
  /** Distinct domain keys overridden when known. */
  overriddenDomainKeys: string[];
  /** Count of override rows when provided by caller. */
  overrideRowCount?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Normalized scoring snapshot derived from legacy `reports.summary` / AI payloads.
 * Unknown / legacy-only fields should live in `metadata` or `rawLegacy` (by reference).
 */
export type AuditOsScoringOutput = {
  provenance: AuditOsScoringProvenance;
  overallScore?: number | null;
  overallLabel?: string | null;
  grade?: string | null;
  /** Normalized 0–1 when source provides numeric confidence; string rubric confidence otherwise stringified. */
  confidence?: number | string | null;
  confidenceLabel?: string | null;
  domainScores: AuditOsDomainScore[];
  sectionScores?: Record<string, number | null | undefined>;
  humanOverrides?: AuditOsHumanOverrideSummary;
  /** Non-breaking bag for forward compatibility. */
  metadata: Record<string, unknown>;
  /** Reference to the original object when adaptation is non-destructive. */
  rawLegacy?: unknown;
};
