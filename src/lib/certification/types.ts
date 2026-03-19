/**
 * Types for the lightweight certification engine.
 * Uses only existing case/report data; no schema changes.
 */

export type CertificationTierKey = "VERIFIED" | "SILVER" | "GOLD" | "PLATINUM";

/** Minimal case row as returned from cases table (existing columns). */
export type CaseRowForCert = {
  id: string;
  status?: string | null;
  audit_mode?: string | null;
  visibility_scope?: string | null;
  /** Optional: exclude demo/sample cases if present in your schema. */
  is_demo?: boolean | null;
  /** Optional: exclude invalid cases if present in your schema. */
  is_invalid?: boolean | null;
};

/** Latest report summary for a case (existing reports.summary shape). */
export type ReportSummaryForCert = {
  forensic_audit?: {
    overall_scores_v1?: {
      performance_score?: number;
      benchmark_score?: number;
      confidence_multiplier?: number;
      confidence_grade?: string;
    };
    domain_scores_v1?: {
      domains?: Array<{ domain_id?: string; weighted_score?: number }>;
    };
    benchmark?: { eligible?: boolean; overall_confidence?: number };
  } | null;
  /** Legacy path */
  forensic?: ReportSummaryForCert["forensic_audit"];
};

/** One case with its latest report summary (what we get from existing queries). */
export type CaseWithReportForCert = {
  case: CaseRowForCert;
  /** Latest report summary; undefined if no completed report. */
  latestReportSummary?: ReportSummaryForCert | null;
};

/** Per-case eligibility result. */
export type CaseEligibility = {
  eligible: boolean;
  reason?: string;
};

/** Aggregated metrics for an entity (clinic or doctor). */
export type CertificationMetrics = {
  eligiblePublicCaseCount: number;
  completedAttributableCaseCount: number;
  weightedCaseQuality: number;
  consistencyIndex: number;
  transparencyRatioRaw: number;
  transparencyRatioScore: number;
  entityCertificationScore: number;
};

/** Full result of certification evaluation. */
export type CertificationResult = {
  /** Null when eligiblePublicCaseCount < 1 (no certification yet). */
  tier: CertificationTierKey | null;
  score: number;
  metrics: CertificationMetrics;
  progressToNextTier: number;
  nextTier: CertificationTierKey | null;
  helpingReasons: string[];
  limitingReasons: string[];
};
