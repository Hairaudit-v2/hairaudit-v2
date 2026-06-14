/**
 * Stage 4B — structural parity between legacy summary/manifest and AuditOS adapters.
 * Not a clinical correctness check.
 */

import type { AuditOsShadowSnapshot } from "./buildAuditOsShadowSnapshot.server";
import type { CaseEvidenceManifest } from "@/lib/evidence/evidenceManifest";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function legacyHasOverallScore(summary: Record<string, unknown>): boolean {
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

function legacyDomainRowCount(summary: Record<string, unknown>): number {
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const d1 = forensic && isRecord(forensic.domain_scores_v1) ? forensic.domain_scores_v1 : null;
  const d2 = isRecord(summary.domain_scores_v1) ? summary.domain_scores_v1 : null;
  const block = d1 ?? d2;
  const domains = block && Array.isArray(block.domains) ? block.domains : [];
  return domains.filter(isRecord).length;
}

function computeLegacyEvidenceItemCount(args: {
  legacyManifest: CaseEvidenceManifest | null;
  uploadCount: number;
}): number {
  const prepared = args.legacyManifest?.prepared_images?.length ?? 0;
  return args.uploadCount + prepared;
}

/** Rough “sections” in legacy summary relevant to report view */
function countLegacyReportSections(summary: Record<string, unknown>): number {
  let n = 0;
  const keys = ["forensic_audit", "forensic", "findings", "patient_narrative", "narrative", "doctor_answers", "clinic_answers"];
  for (const k of keys) {
    const v = summary[k];
    if (v !== null && v !== undefined) n += 1;
  }
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  if (isRecord(forensic)) {
    if (Array.isArray(forensic.key_findings) && forensic.key_findings.length) n += 1;
    if (isRecord(forensic.data_quality)) n += 1;
  }
  return n;
}

function legacyHasLimitations(summary: Record<string, unknown>): boolean {
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const dq = forensic && isRecord(forensic.data_quality) ? forensic.data_quality : null;
  const lim = dq && Array.isArray(dq.limitations) ? dq.limitations : [];
  return lim.length > 0;
}

function legacyHasConfidence(summary: Record<string, unknown>): boolean {
  if (summary.confidence !== null && summary.confidence !== undefined) return true;
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  return forensic != null && forensic.confidence !== null && forensic.confidence !== undefined;
}

function countAdaptedEvidenceItems(manifest: AuditOsShadowSnapshot["evidenceManifest"]): number {
  if (!manifest) return 0;
  return manifest.images.length + manifest.documents.length + manifest.otherUploads.length;
}

function countAdaptedReportSections(report: AuditOsShadowSnapshot["normalizedReport"]): number {
  if (!report) return 0;
  let n = report.findings.length > 0 ? 1 : 0;
  if (report.recommendations.length) n += 1;
  if (report.limitations.length) n += 1;
  if (report.confidence !== null && report.confidence !== undefined) n += 1;
  if (report.scoring.domainScores.length) n += 1;
  return n;
}

export type AuditOsShadowDiffResult = {
  status: "ok" | "warning";
  warnings: string[];
  metrics: {
    legacyOverallPresent: boolean;
    adaptedOverallPresent: boolean;
    legacyDomainCount: number;
    adaptedDomainCount: number;
    legacyEvidenceItemCount: number;
    adaptedEvidenceItemCount: number;
    legacyReportSectionCount: number;
    adaptedReportSectionCount: number;
    legacyLimitationsPresent: boolean;
    adaptedLimitationsPresent: boolean;
    legacyConfidencePresent: boolean;
    adaptedConfidencePresent: boolean;
  };
};

export function diffAuditOsShadowSnapshot(args: {
  legacySummary: unknown;
  legacyEvidenceManifest: CaseEvidenceManifest | null;
  uploadCount: number;
  snapshot: AuditOsShadowSnapshot;
}): AuditOsShadowDiffResult {
  const warnings: string[] = [];
  const summary = isRecord(args.legacySummary) ? args.legacySummary : {};

  const legacyOverallPresent = legacyHasOverallScore(summary);
  const adaptedOverallPresent =
    args.snapshot.normalizedScoring != null &&
    args.snapshot.normalizedScoring.overallScore !== null &&
    args.snapshot.normalizedScoring.overallScore !== undefined;

  const legacyDomainCount = legacyDomainRowCount(summary);
  const adaptedDomainCount = args.snapshot.normalizedScoring?.domainScores.length ?? 0;

  const legacyEvidenceItemCount = computeLegacyEvidenceItemCount({
    legacyManifest: args.legacyEvidenceManifest,
    uploadCount: args.uploadCount,
  });
  const adaptedEvidenceItemCount = countAdaptedEvidenceItems(args.snapshot.evidenceManifest);

  const legacyReportSectionCount = countLegacyReportSections(summary);
  const adaptedReportSectionCount = countAdaptedReportSections(args.snapshot.normalizedReport);

  const legacyLimitationsPresent = legacyHasLimitations(summary);
  const adaptedLimitationsPresent = (args.snapshot.normalizedReport?.limitations.length ?? 0) > 0;

  const legacyConfidencePresent = legacyHasConfidence(summary);
  const adaptedConfidencePresent =
    args.snapshot.normalizedReport != null &&
    args.snapshot.normalizedReport.confidence !== null &&
    args.snapshot.normalizedReport.confidence !== undefined;

  if (legacyOverallPresent !== adaptedOverallPresent) {
    warnings.push(
      `overall score presence mismatch (legacy=${legacyOverallPresent}, adapted=${adaptedOverallPresent})`
    );
  }
  if (legacyDomainCount !== adaptedDomainCount) {
    warnings.push(`domain count mismatch (legacy=${legacyDomainCount}, adapted=${adaptedDomainCount})`);
  }
  if (Math.abs(legacyEvidenceItemCount - adaptedEvidenceItemCount) > 2) {
    warnings.push(
      `evidence item count drift (legacy=${legacyEvidenceItemCount}, adapted=${adaptedEvidenceItemCount})`
    );
  }
  if (Math.abs(legacyReportSectionCount - adaptedReportSectionCount) > 4) {
    warnings.push(
      `report section count drift (legacy=${legacyReportSectionCount}, adapted=${adaptedReportSectionCount})`
    );
  }
  if (legacyLimitationsPresent !== adaptedLimitationsPresent) {
    warnings.push(
      `limitations presence mismatch (legacy=${legacyLimitationsPresent}, adapted=${adaptedLimitationsPresent})`
    );
  }
  if (legacyConfidencePresent !== adaptedConfidencePresent) {
    warnings.push(
      `confidence presence mismatch (legacy=${legacyConfidencePresent}, adapted=${adaptedConfidencePresent})`
    );
  }

  for (const w of args.snapshot.warnings) {
    warnings.push(`snapshot: ${w}`);
  }

  const status: "ok" | "warning" = warnings.length ? "warning" : "ok";

  return {
    status,
    warnings,
    metrics: {
      legacyOverallPresent,
      adaptedOverallPresent,
      legacyDomainCount,
      adaptedDomainCount,
      legacyEvidenceItemCount,
      adaptedEvidenceItemCount,
      legacyReportSectionCount,
      adaptedReportSectionCount,
      legacyLimitationsPresent,
      adaptedLimitationsPresent,
      legacyConfidencePresent,
      adaptedConfidencePresent,
    },
  };
}
