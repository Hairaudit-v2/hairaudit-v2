import { adaptExistingAuditScore } from "@/lib/auditos/scoring/adaptExistingAuditScore";
import { buildEvidenceManifestFromLegacy } from "@/lib/auditos/evidence/buildEvidenceManifestFromLegacy";
import type { CaseEvidenceManifest } from "@/lib/evidence/evidenceManifest";
import type { AuditOsNormalizedReport, AuditOsReportFinding } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function collectFindings(summary: Record<string, unknown>): AuditOsReportFinding[] {
  const out: AuditOsReportFinding[] = [];
  const rawFindings = summary.findings;
  if (Array.isArray(rawFindings)) {
    for (const f of rawFindings) {
      if (!isRecord(f)) continue;
      out.push({
        title: str(f.title) ?? "Finding",
        severity: str(f.severity),
        summary: str(f.summary ?? f.description),
        recommendedNextStep: str(f.recommended_next_step ?? f.recommendedNextStep),
        metadata: { ...f },
      });
    }
  }
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const kf = forensic?.key_findings;
  if (Array.isArray(kf)) {
    for (const f of kf) {
      if (!isRecord(f)) continue;
      out.push({
        title: str(f.title) ?? "Key finding",
        severity: str(f.severity),
        summary: str(f.impact),
        recommendedNextStep: str(f.recommended_next_step),
        metadata: { ...f },
      });
    }
  }
  return out;
}

function collectRecommendations(summary: Record<string, unknown>, findings: AuditOsReportFinding[]): string[] {
  const recs: string[] = [];
  const narrative = summary.patient_narrative ?? summary.narrative;
  if (isRecord(narrative)) {
    const follow = narrative.follow_up_advice ?? narrative.followUpAdvice;
    const s = str(follow);
    if (s) recs.push(s);
  }
  for (const f of findings) {
    const step = f.recommendedNextStep;
    if (step && !recs.includes(step)) recs.push(step);
  }
  return recs.slice(0, 50);
}

function collectLimitations(summary: Record<string, unknown>): string[] {
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const dq = forensic?.data_quality;
  if (isRecord(dq)) {
    const lim = dq.limitations;
    if (Array.isArray(lim)) return lim.map((x) => String(x)).filter(Boolean);
  }
  return [];
}

export type LegacyReportRow = {
  id?: string | null;
  version?: number | null;
  created_at?: string | null;
  summary?: unknown;
  auditor_review_eligibility?: string | null;
  auditor_review_status?: string | null;
  auditor_review_reason?: string | null;
  provisional_status?: string | null;
  counts_for_awards?: boolean | null;
};

export type LegacyUploadRow = {
  id?: string | null;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Compose normalized AuditOS report view from existing row shapes. Does not mutate storage.
 */
export function adaptLegacyReportModel(args: {
  caseId: string;
  reportRow?: LegacyReportRow | null;
  summaryOverride?: Record<string, unknown> | null;
  legacyEvidenceManifest?: CaseEvidenceManifest | null;
  uploads?: ReadonlyArray<LegacyUploadRow> | null;
}): AuditOsNormalizedReport {
  const summary = (args.summaryOverride ??
    (isRecord(args.reportRow?.summary) ? (args.reportRow!.summary as Record<string, unknown>) : {})) as Record<string, unknown>;

  const scoring = adaptExistingAuditScore(summary, { preserveLegacyReference: true });
  const evidenceManifest = buildEvidenceManifestFromLegacy({
    caseId: args.caseId,
    legacyManifest: args.legacyEvidenceManifest ?? null,
    uploads: args.uploads ?? [],
  });

  const findings = collectFindings(summary);
  const recommendations = collectRecommendations(summary, findings);
  const limitations = collectLimitations(summary);

  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
  const conf = forensic?.confidence ?? summary.confidence;

  return {
    caseId: args.caseId,
    reportId: args.reportRow?.id ?? null,
    reportVersion: args.reportRow?.version ?? null,
    generatedAt: args.reportRow?.created_at ?? null,
    scoring,
    evidenceManifest,
    findings,
    recommendations,
    confidence: typeof conf === "string" || typeof conf === "number" ? conf : null,
    limitations,
    humanReview: args.reportRow
      ? {
          auditorReviewEligibility: args.reportRow.auditor_review_eligibility ?? null,
          auditorReviewStatus: args.reportRow.auditor_review_status ?? null,
          auditorReviewReason: args.reportRow.auditor_review_reason ?? null,
          provisionalStatus: args.reportRow.provisional_status ?? null,
          countsForAwards: args.reportRow.counts_for_awards ?? null,
        }
      : undefined,
    metadata: {
      audit_mode: forensic?.auditMode ?? forensic?.audit_mode,
    },
    rawSummary: summary,
  };
}
