/**
 * Stage 4B — non-authoritative AuditOS shadow snapshot from legacy pipeline objects.
 * Tolerant: never throws; captures per-adapter warnings and partial outputs.
 */

import { adaptExistingAuditScore } from "@/lib/auditos/scoring/adaptExistingAuditScore";
import type { AuditOsScoringOutput } from "@/lib/auditos/scoring/types";
import { buildEvidenceManifestFromLegacy } from "@/lib/auditos/evidence/buildEvidenceManifestFromLegacy";
import type { AuditOsEvidenceManifest } from "@/lib/auditos/evidence/types";
import { adaptLegacyReportModel, type LegacyReportRow, type LegacyUploadRow } from "@/lib/auditos/reports/adaptLegacyReportModel";
import type { AuditOsNormalizedReport } from "@/lib/auditos/reports/types";
import type { CaseEvidenceManifest } from "@/lib/evidence/evidenceManifest";

export const AUDITOS_ADAPTER_VERSIONS = {
  scoringAdapter: "adaptExistingAuditScore@stage4a",
  evidenceAdapter: "buildEvidenceManifestFromLegacy@stage4a",
  reportAdapter: "adaptLegacyReportModel@stage4a",
  shadowSnapshot: "buildAuditOsShadowSnapshot@stage4b",
} as const;

export type AuditOsAdapterVersions = typeof AUDITOS_ADAPTER_VERSIONS;

export type AuditOsShadowSnapshotInput = {
  caseId: string;
  /** Latest or in-flight report row fields when available */
  reportRow?: LegacyReportRow | null;
  /** When building before a row exists, pass the summary blob that will be persisted */
  summaryOverride?: Record<string, unknown> | null;
  /** Legacy `CaseEvidenceManifest` from prepare step or DB */
  legacyEvidenceManifest?: CaseEvidenceManifest | null;
  /** Upload rows aligned with `LegacyUploadRow` */
  uploads?: ReadonlyArray<LegacyUploadRow> | null;
  /** `audit_score_overrides` rows for human override summary on scoring adapter */
  humanOverrideRows?: ReadonlyArray<Record<string, unknown>> | null;
  /** ISO timestamp for this shadow run (defaults to now) */
  generatedAt?: string | null;
};

export type AuditOsShadowSnapshot = {
  normalizedScoring: AuditOsScoringOutput | null;
  evidenceManifest: AuditOsEvidenceManifest | null;
  normalizedReport: AuditOsNormalizedReport | null;
  warnings: string[];
  adapterVersions: AuditOsAdapterVersions;
  generatedAt: string | null;
};

function warn(warnings: string[], msg: string, err: unknown) {
  const m = String((err as Error)?.message ?? err ?? "unknown error");
  warnings.push(`${msg}: ${m}`);
}

export function buildAuditOsShadowSnapshot(input: AuditOsShadowSnapshotInput): AuditOsShadowSnapshot {
  const warnings: string[] = [];
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const summaryForScoring =
    input.summaryOverride ??
    (input.reportRow?.summary && typeof input.reportRow.summary === "object"
      ? (input.reportRow.summary as Record<string, unknown>)
      : null);

  let normalizedScoring: AuditOsScoringOutput | null = null;
  try {
    normalizedScoring = adaptExistingAuditScore(summaryForScoring ?? {}, {
      overrideRows: input.humanOverrideRows ?? undefined,
      preserveLegacyReference: true,
    });
  } catch (e) {
    warn(warnings, "adaptExistingAuditScore failed", e);
  }

  let evidenceManifest: AuditOsEvidenceManifest | null = null;
  try {
    evidenceManifest = buildEvidenceManifestFromLegacy({
      caseId: input.caseId,
      legacyManifest: input.legacyEvidenceManifest ?? null,
      uploads: input.uploads ?? [],
    });
  } catch (e) {
    warn(warnings, "buildEvidenceManifestFromLegacy failed", e);
  }

  let normalizedReport: AuditOsNormalizedReport | null = null;
  try {
    normalizedReport = adaptLegacyReportModel({
      caseId: input.caseId,
      reportRow: input.reportRow ?? undefined,
      summaryOverride: input.summaryOverride ?? undefined,
      legacyEvidenceManifest: input.legacyEvidenceManifest ?? null,
      uploads: input.uploads ?? [],
    });
  } catch (e) {
    warn(warnings, "adaptLegacyReportModel failed", e);
  }

  return {
    normalizedScoring,
    evidenceManifest,
    normalizedReport,
    warnings,
    adapterVersions: { ...AUDITOS_ADAPTER_VERSIONS },
    generatedAt,
  };
}
