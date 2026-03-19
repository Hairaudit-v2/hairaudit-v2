/**
 * Certification metrics from eligible cases.
 * Computes: eligiblePublicCaseCount, completedAttributableCaseCount, weightedCaseQuality,
 * consistencyIndex, transparencyRatioRaw, transparencyRatioScore, entityCertificationScore.
 */

import type { CaseWithReportForCert, CertificationMetrics } from "./types";
import { isCaseEligible } from "./eligibility";

function getOverallScore(summary: CaseWithReportForCert["latestReportSummary"]): number | null {
  if (!summary) return null;
  const forensic = summary.forensic_audit ?? summary.forensic;
  if (!forensic?.overall_scores_v1) return null;
  const v1 = forensic.overall_scores_v1;
  const score = v1.performance_score ?? v1.benchmark_score;
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

function getIntegrity(summary: CaseWithReportForCert["latestReportSummary"]): number | null {
  if (!summary) return null;
  const forensic = summary.forensic_audit ?? summary.forensic;
  const domains = forensic?.domain_scores_v1?.domains ?? [];
  const di = domains.find((d) => String(d?.domain_id ?? "") === "DI");
  const n = Number(di?.weighted_score);
  return Number.isFinite(n) ? n : null;
}

function getConfidence(summary: CaseWithReportForCert["latestReportSummary"]): number | null {
  if (!summary) return null;
  const forensic = summary.forensic_audit ?? summary.forensic;
  const v1 = forensic?.overall_scores_v1;
  const bench = forensic?.benchmark as { overall_confidence?: number } | undefined;
  const mult = v1?.confidence_multiplier ?? bench?.overall_confidence;
  const n = Number(mult);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute all certification metrics from a list of cases with their latest report summaries.
 */
export function computeCertificationMetrics(casesWithReports: CaseWithReportForCert[]): CertificationMetrics {
  const eligible: CaseWithReportForCert[] = [];
  for (const cw of casesWithReports) {
    const { eligible: ok } = isCaseEligible(cw.case, cw.latestReportSummary);
    if (ok) eligible.push(cw);
  }

  const eligiblePublicCaseCount = eligible.length;
  const completedAttributableCaseCount = casesWithReports.filter(
    (cw) => String(cw.case.status ?? "").toLowerCase() === "complete"
  ).length;

  if (eligible.length === 0) {
    return {
      eligiblePublicCaseCount: 0,
      completedAttributableCaseCount,
      weightedCaseQuality: 0,
      consistencyIndex: 0,
      transparencyRatioRaw: 0,
      transparencyRatioScore: 0,
      entityCertificationScore: 0,
    };
  }

  const scores: number[] = [];
  const integrities: number[] = [];
  const confidences: number[] = [];
  for (const cw of eligible) {
    const s = getOverallScore(cw.latestReportSummary);
    const i = getIntegrity(cw.latestReportSummary);
    const c = getConfidence(cw.latestReportSummary);
    if (s != null) scores.push(s);
    if (i != null) integrities.push(i);
    if (c != null) confidences.push(c);
  }

  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const avgIntegrity = integrities.length ? integrities.reduce((a, b) => a + b, 0) / integrities.length : 0;
  const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

  const weightedCaseQuality = Math.round(avgScore * 10) / 10;
  const consistencyIndex = scores.length >= 2
    ? Math.round((100 - Math.min(100, (Math.max(...scores) - Math.min(...scores)) * 0.5)) * 10) / 10
    : 100;
  const transparencyRatioRaw = avgConfidence;
  const transparencyRatioScore = Math.round(Math.min(100, transparencyRatioRaw * 100) * 10) / 10;

  const entityCertificationScore = Math.round(
    (weightedCaseQuality * 0.5 + (avgIntegrity / 100) * 25 + transparencyRatioScore * 0.25) * 10
  ) / 10;

  return {
    eligiblePublicCaseCount,
    completedAttributableCaseCount,
    weightedCaseQuality,
    consistencyIndex: Math.min(100, Math.max(0, consistencyIndex)),
    transparencyRatioRaw,
    transparencyRatioScore,
    entityCertificationScore: Math.min(100, Math.max(0, entityCertificationScore)),
  };
}
