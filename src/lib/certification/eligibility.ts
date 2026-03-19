/**
 * Case eligibility gate for certification.
 * Eligible = public, completed, has overall score, confidence >= 60, integrity >= 60, not demo/invalid (if flags exist).
 */

import { ELIGIBILITY_MIN_CONFIDENCE, ELIGIBILITY_MIN_INTEGRITY } from "./constants";
import type { CaseRowForCert, CaseEligibility, ReportSummaryForCert } from "./types";

function isPublic(c: CaseRowForCert): boolean {
  return c.audit_mode === "public" || c.visibility_scope === "public";
}

function isCompleted(c: CaseRowForCert): boolean {
  return String(c.status ?? "").toLowerCase() === "complete";
}

function getOverallScore(summary: ReportSummaryForCert | null | undefined): number | null {
  if (!summary) return null;
  const forensic = summary.forensic_audit ?? summary.forensic;
  if (!forensic?.overall_scores_v1) return null;
  const v1 = forensic.overall_scores_v1;
  const score = v1.performance_score ?? v1.benchmark_score;
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

function getConfidence(summary: ReportSummaryForCert | null | undefined): number | null {
  if (!summary) return null;
  const forensic = summary.forensic_audit ?? summary.forensic;
  const v1 = forensic?.overall_scores_v1;
  const bench = forensic?.benchmark;
  const mult = v1?.confidence_multiplier ?? (bench as { overall_confidence?: number } | undefined)?.overall_confidence;
  const n = Number(mult);
  return Number.isFinite(n) ? n : null;
}

function getIntegrity(summary: ReportSummaryForCert | null | undefined): number | null {
  if (!summary) return null;
  const forensic = summary.forensic_audit ?? summary.forensic;
  const domains = forensic?.domain_scores_v1?.domains ?? [];
  const di = domains.find((d) => String(d?.domain_id ?? "") === "DI");
  const n = Number(di?.weighted_score);
  return Number.isFinite(n) ? n : null;
}

/**
 * Returns whether the case is eligible for certification counting.
 * Uses only existing case + report summary fields.
 */
export function isCaseEligible(
  caseRow: CaseRowForCert,
  latestReportSummary?: ReportSummaryForCert | null
): CaseEligibility {
  if (!isPublic(caseRow)) {
    return { eligible: false, reason: "Case is not public" };
  }
  if (!isCompleted(caseRow)) {
    return { eligible: false, reason: "Case is not completed" };
  }
  if (caseRow.is_demo === true) {
    return { eligible: false, reason: "Demo case" };
  }
  if (caseRow.is_invalid === true) {
    return { eligible: false, reason: "Invalid case" };
  }

  const overall = getOverallScore(latestReportSummary);
  if (overall == null) {
    return { eligible: false, reason: "No overall score" };
  }

  const confidence = getConfidence(latestReportSummary);
  const confidencePct = confidence != null ? confidence * 100 : null;
  if (confidencePct == null || confidencePct < ELIGIBILITY_MIN_INTEGRITY) {
    return { eligible: false, reason: "Confidence below 60" };
  }

  const integrity = getIntegrity(latestReportSummary);
  if (integrity == null || integrity < ELIGIBILITY_MIN_INTEGRITY) {
    return { eligible: false, reason: "Documentation integrity below 60" };
  }

  return { eligible: true };
}
