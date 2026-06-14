import type { AuditOsEvidenceManifest } from "@/lib/auditos/evidence/types";
import type { AuditOsScoringOutput } from "@/lib/auditos/scoring/types";

export type AuditOsReportFinding = {
  title: string;
  severity?: string | null;
  summary?: string | null;
  recommendedNextStep?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditOsHumanReviewMetadata = {
  auditorReviewEligibility?: string | null;
  auditorReviewStatus?: string | null;
  auditorReviewReason?: string | null;
  provisionalStatus?: string | null;
  countsForAwards?: boolean | null;
  metadata?: Record<string, unknown>;
};

/**
 * Stable internal report view for FI-aligned intelligence (read/adapter only in Stage 4A).
 */
export type AuditOsNormalizedReport = {
  caseId: string;
  reportId?: string | null;
  reportVersion?: number | null;
  generatedAt?: string | null;
  scoring: AuditOsScoringOutput;
  evidenceManifest: AuditOsEvidenceManifest;
  findings: AuditOsReportFinding[];
  recommendations: string[];
  confidence?: string | number | null;
  limitations: string[];
  humanReview?: AuditOsHumanReviewMetadata;
  metadata: Record<string, unknown>;
  rawSummary?: unknown;
};
