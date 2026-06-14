/**
 * Stage 4B/4C — Inngest-only helpers: shadow snapshot + diff logging + FI dry-run + optional persistence.
 * Must not throw into the audit job; failures are swallowed after logging.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAuditOsShadowSnapshot } from "./buildAuditOsShadowSnapshot.server";
import { diffAuditOsShadowSnapshot } from "./diffAuditOsShadowSnapshot";
import { isAuditOsShadowPersistEnabled, shouldLogAuditOsShadow } from "./auditOsShadowEnv.server";
import { emitAuditOsEvent } from "@/lib/auditos/events/emitAuditOsEvent.server";
import type { LegacyReportRow, LegacyUploadRow } from "@/lib/auditos/reports/adaptLegacyReportModel";
import type { CaseEvidenceManifest } from "@/lib/evidence/evidenceManifest";
import { persistAuditOsShadowSnapshot } from "./persistAuditOsShadowSnapshot.server";

type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
};

function scoringVersionFromSummary(summary: Record<string, unknown>): string {
  const da = summary.doctor_answers;
  if (da && typeof da === "object" && "scoring_version" in (da as object)) {
    const v = (da as Record<string, unknown>).scoring_version;
    if (typeof v === "string" && v.trim()) return v;
  }
  return "v1";
}

async function maybePersistShadow(args: {
  caseId: string;
  reportId: string | null;
  reportVersion: number | null;
  snapshotKind: "audit_completed" | "report_generated";
  sourceEventName: string;
  snapshot: ReturnType<typeof buildAuditOsShadowSnapshot>;
  diff: ReturnType<typeof diffAuditOsShadowSnapshot>;
  logger: Logger;
}): Promise<void> {
  if (!isAuditOsShadowPersistEnabled()) return;
  try {
    const res = await persistAuditOsShadowSnapshot({
      caseId: args.caseId,
      reportId: args.reportId,
      reportVersion: args.reportVersion,
      snapshotKind: args.snapshotKind,
      sourceEventName: args.sourceEventName,
      snapshot: args.snapshot,
      structuralDiff: args.diff,
    });
    if (!res.ok) {
      args.logger.warn("AuditOS shadow persist failed (ignored)", {
        caseId: args.caseId,
        error: res.error,
        snapshotKind: args.snapshotKind,
      });
    }
  } catch (e) {
    args.logger.warn("AuditOS shadow persist threw (ignored)", {
      caseId: args.caseId,
      message: String((e as Error)?.message ?? e),
    });
  }
}

export async function runAuditOsShadowAfterReportInsert(args: {
  supabase: SupabaseClient;
  caseId: string;
  nextVersion: number;
  insertedReportId: string;
  insertedReportCreatedAt: string | null;
  summary: Record<string, unknown>;
  legacyEvidenceManifest: CaseEvidenceManifest | null;
  uploads: ReadonlyArray<LegacyUploadRow>;
  auditorReviewEligibility: string;
  auditorReviewStatus: string;
  auditorReviewReason: string | null;
  provisionalStatus: string;
  countsForAwards: boolean;
  logger: Logger;
}): Promise<void> {
  try {
    let overrideRows: ReadonlyArray<Record<string, unknown>> = [];
    try {
      const { data, error } = await args.supabase
        .from("audit_score_overrides")
        .select("domain_key, domainKey")
        .eq("report_id", args.insertedReportId);
      if (!error && Array.isArray(data)) overrideRows = data as Record<string, unknown>[];
    } catch {
      overrideRows = [];
    }

    const reportRow: LegacyReportRow = {
      id: args.insertedReportId,
      version: args.nextVersion,
      created_at: args.insertedReportCreatedAt,
      summary: args.summary,
      auditor_review_eligibility: args.auditorReviewEligibility,
      auditor_review_status: args.auditorReviewStatus,
      auditor_review_reason: args.auditorReviewReason,
      provisional_status: args.provisionalStatus,
      counts_for_awards: args.countsForAwards,
    };

    const snapshot = buildAuditOsShadowSnapshot({
      caseId: args.caseId,
      reportRow,
      legacyEvidenceManifest: args.legacyEvidenceManifest,
      uploads: args.uploads,
      humanOverrideRows: overrideRows,
      generatedAt: args.insertedReportCreatedAt ?? new Date().toISOString(),
    });

    const diff = diffAuditOsShadowSnapshot({
      legacySummary: args.summary,
      legacyEvidenceManifest: args.legacyEvidenceManifest,
      uploadCount: args.uploads.length,
      snapshot,
    });

    if (shouldLogAuditOsShadow()) {
      args.logger.info("AuditOS shadow (post-report-insert)", {
        caseId: args.caseId,
        reportVersion: args.nextVersion,
        diffStatus: diff.status,
        metrics: diff.metrics,
        adapterVersions: snapshot.adapterVersions,
        warnings: [...snapshot.warnings, ...diff.warnings],
      });
    }

    await maybePersistShadow({
      caseId: args.caseId,
      reportId: args.insertedReportId,
      reportVersion: args.nextVersion,
      snapshotKind: "audit_completed",
      sourceEventName: "hairaudit.audit.completed",
      snapshot,
      diff,
      logger: args.logger,
    });

    try {
      await emitAuditOsEvent("hairaudit.audit.completed", {
        case_id: args.caseId,
        report_id: args.insertedReportId,
        report_version: args.nextVersion,
        scoring_engine_version: "hairaudit.scoring_engine.v1",
        scoring_version: scoringVersionFromSummary(args.summary),
        evidence_manifest_version: "hairaudit.evidence_manifest.v1",
        generated_at: args.insertedReportCreatedAt ?? new Date().toISOString(),
        event_schema: "hairaudit.audit.completed@stage4b",
      });
    } catch (e) {
      args.logger.warn("AuditOS FI emit hairaudit.audit.completed failed (ignored)", {
        caseId: args.caseId,
        message: String((e as Error)?.message ?? e),
      });
    }
  } catch (e) {
    args.logger.warn("AuditOS shadow instrumentation failed (ignored)", {
      caseId: args.caseId,
      message: String((e as Error)?.message ?? e),
    });
  }
}

export async function emitAuditOsReportGeneratedSafe(args: {
  supabase: SupabaseClient;
  caseId: string;
  reportVersion: number;
  logger: Logger;
  /** When set, avoids extra uploads/manifest queries for shadow log/persist paths. */
  shadowContext?: {
    uploads: ReadonlyArray<LegacyUploadRow>;
    legacyEvidenceManifest: CaseEvidenceManifest | null;
  };
}): Promise<void> {
  try {
    const { data: row, error } = await args.supabase
      .from("reports")
      .select(
        "id, summary, created_at, version, auditor_review_eligibility, auditor_review_status, auditor_review_reason, provisional_status, counts_for_awards"
      )
      .eq("case_id", args.caseId)
      .eq("version", args.reportVersion)
      .maybeSingle();
    if (error || !row?.id) return;

    const summary = (row.summary && typeof row.summary === "object" ? row.summary : {}) as Record<string, unknown>;

    try {
      await emitAuditOsEvent("hairaudit.report.generated", {
        case_id: args.caseId,
        report_id: row.id,
        report_version: args.reportVersion,
        scoring_engine_version: "hairaudit.scoring_engine.v1",
        scoring_version: scoringVersionFromSummary(summary),
        evidence_manifest_version: "hairaudit.evidence_manifest.v1",
        generated_at: row.created_at ?? new Date().toISOString(),
        event_schema: "hairaudit.report.generated@stage4b",
      });
    } catch (e) {
      args.logger.warn("AuditOS FI emit hairaudit.report.generated failed (ignored)", {
        caseId: args.caseId,
        message: String((e as Error)?.message ?? e),
      });
    }

    const needHeavy = shouldLogAuditOsShadow() || isAuditOsShadowPersistEnabled();
    if (!needHeavy) return;

    let uploads: ReadonlyArray<LegacyUploadRow>;
    let manifest: CaseEvidenceManifest | null;

    if (args.shadowContext) {
      uploads = args.shadowContext.uploads;
      manifest = args.shadowContext.legacyEvidenceManifest;
    } else {
      const { data: up } = await args.supabase
        .from("uploads")
        .select("id, type, storage_path, metadata, created_at")
        .eq("case_id", args.caseId)
        .order("created_at", { ascending: false });
      uploads = (up ?? []) as LegacyUploadRow[];
      const { loadLatestEvidenceManifest } = await import("@/lib/evidence/evidenceManifest");
      manifest = await loadLatestEvidenceManifest({ supabase: args.supabase, caseId: args.caseId });
    }

    let overrideRows: ReadonlyArray<Record<string, unknown>> = [];
    try {
      const { data: ov, error: ovErr } = await args.supabase
        .from("audit_score_overrides")
        .select("domain_key, domainKey")
        .eq("report_id", row.id);
      if (!ovErr && Array.isArray(ov)) overrideRows = ov as Record<string, unknown>[];
    } catch {
      overrideRows = [];
    }

    const reportRow: LegacyReportRow = {
      id: row.id,
      version: row.version ?? args.reportVersion,
      created_at: row.created_at ?? null,
      summary,
      auditor_review_eligibility: row.auditor_review_eligibility ?? null,
      auditor_review_status: row.auditor_review_status ?? null,
      auditor_review_reason: row.auditor_review_reason ?? null,
      provisional_status: row.provisional_status ?? null,
      counts_for_awards: row.counts_for_awards ?? null,
    };

    const snapshot = buildAuditOsShadowSnapshot({
      caseId: args.caseId,
      reportRow,
      legacyEvidenceManifest: manifest,
      uploads,
      humanOverrideRows: overrideRows,
      generatedAt: row.created_at ?? new Date().toISOString(),
    });

    const diff = diffAuditOsShadowSnapshot({
      legacySummary: summary,
      legacyEvidenceManifest: manifest,
      uploadCount: uploads.length,
      snapshot,
    });

    if (shouldLogAuditOsShadow()) {
      args.logger.info("AuditOS shadow (report-generated)", {
        caseId: args.caseId,
        reportVersion: args.reportVersion,
        diffStatus: diff.status,
        metrics: diff.metrics,
        adapterVersions: snapshot.adapterVersions,
        warnings: [...snapshot.warnings, ...diff.warnings],
      });
    }

    await maybePersistShadow({
      caseId: args.caseId,
      reportId: row.id,
      reportVersion: args.reportVersion,
      snapshotKind: "report_generated",
      sourceEventName: "hairaudit.report.generated",
      snapshot,
      diff,
      logger: args.logger,
    });
  } catch (e) {
    args.logger.warn("AuditOS report.generated shadow wiring failed (ignored)", {
      caseId: args.caseId,
      message: String((e as Error)?.message ?? e),
    });
  }
}