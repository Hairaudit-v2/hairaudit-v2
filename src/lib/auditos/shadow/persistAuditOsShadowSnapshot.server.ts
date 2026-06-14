/**
 * Stage 4C — persist AuditOS shadow snapshots (service role only, additive, idempotent).
 * Callers must wrap in try/catch; failures must not break audit/report jobs.
 */

import type { AuditOsShadowSnapshot } from "./buildAuditOsShadowSnapshot.server";
import type { AuditOsShadowDiffResult } from "./diffAuditOsShadowSnapshot";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditOsEvidenceManifest } from "@/lib/auditos/evidence/types";
import type { AuditOsNormalizedReport } from "@/lib/auditos/reports/types";
import type { AuditOsScoringOutput } from "@/lib/auditos/scoring/types";

export const AUDITOS_SHADOW_SNAPSHOTS_TABLE = "hairaudit_auditos_shadow_snapshots" as const;

export type AuditOsShadowSnapshotKind = "audit_completed" | "report_generated" | "manual_debug";

const PII_METADATA_KEYS = new Set([
  "email",
  "patient_email",
  "phone",
  "patient_phone",
  "name",
  "patient_name",
  "first_name",
  "last_name",
  "full_name",
  "address",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Strip paths and common PII-bearing metadata from evidence items before persistence. */
function sanitizeEvidenceManifestForPersist(manifest: AuditOsEvidenceManifest | null): Record<string, unknown> | null {
  if (!manifest) return null;
  const stripItem = (item: Record<string, unknown>) => {
    const meta = item.metadata;
    const nextMeta: Record<string, unknown> = {};
    if (isRecord(meta)) {
      for (const [k, v] of Object.entries(meta)) {
        if (PII_METADATA_KEYS.has(k.toLowerCase())) continue;
        nextMeta[k] = v;
      }
    }
    return {
      ...item,
      storagePath: null,
      metadata: Object.keys(nextMeta).length ? nextMeta : undefined,
    };
  };
  return {
    ...manifest,
    images: manifest.images.map((i) => stripItem({ ...i } as Record<string, unknown>)),
    documents: manifest.documents.map((i) => stripItem({ ...i } as Record<string, unknown>)),
    otherUploads: manifest.otherUploads.map((i) => stripItem({ ...i } as Record<string, unknown>)),
  };
}

function sanitizeScoringForPersist(scoring: AuditOsScoringOutput | null): Record<string, unknown> | null {
  if (!scoring) return null;
  const o = { ...(scoring as Record<string, unknown>) };
  delete o.rawLegacy;
  const meta = o.metadata;
  if (meta && typeof meta === "object") {
    const m = { ...(meta as Record<string, unknown>) };
    delete m.patient_answers;
    delete m.patient_audit;
    delete m.patient_audit_v2;
    o.metadata = m;
  }
  return o;
}

function sanitizeNormalizedReportForPersist(report: AuditOsNormalizedReport | null): Record<string, unknown> | null {
  if (!report) return null;
  const o = { ...(report as Record<string, unknown>) };
  delete o.rawSummary;
  const nested = o.scoring;
  if (nested && typeof nested === "object") {
    o.scoring = sanitizeScoringForPersist(nested as AuditOsScoringOutput);
  }
  o.evidenceManifest = sanitizeEvidenceManifestForPersist(report.evidenceManifest);
  return o;
}

export function buildStructuralDiffForPersist(diff: AuditOsShadowDiffResult): Record<string, unknown> {
  const preview = diff.warnings.slice(0, 40).map((w) => (w.length > 500 ? `${w.slice(0, 500)}…` : w));
  return {
    status: diff.status,
    metrics: diff.metrics,
    warnings_preview: preview,
  };
}

/** Exported for tests — removes raw legacy blobs and storage paths from shadow JSON. */
export function sanitizeAuditOsShadowPersistPayload(args: {
  snapshot: AuditOsShadowSnapshot;
  structuralDiff: AuditOsShadowDiffResult;
}): {
  adapter_versions: Record<string, unknown>;
  normalized_scoring: Record<string, unknown> | null;
  evidence_manifest: Record<string, unknown> | null;
  normalized_report: Record<string, unknown> | null;
  structural_diff: Record<string, unknown>;
  warnings: string[];
} {
  const warnings = [...args.snapshot.warnings, ...args.structuralDiff.warnings]
    .slice(0, 120)
    .map((w) => (w.length > 2000 ? `${w.slice(0, 2000)}…` : w));

  return {
    adapter_versions: { ...args.snapshot.adapterVersions } as Record<string, unknown>,
    normalized_scoring: sanitizeScoringForPersist(args.snapshot.normalizedScoring),
    evidence_manifest: sanitizeEvidenceManifestForPersist(args.snapshot.evidenceManifest),
    normalized_report: sanitizeNormalizedReportForPersist(args.snapshot.normalizedReport),
    structural_diff: buildStructuralDiffForPersist(args.structuralDiff),
    warnings,
  };
}

export type PersistAuditOsShadowSnapshotResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Upsert by (case_id, report_id, report_version, snapshot_kind) for automated kinds.
 */
export async function persistAuditOsShadowSnapshot(args: {
  caseId: string;
  reportId: string | null;
  reportVersion: number | null;
  snapshotKind: AuditOsShadowSnapshotKind;
  sourceEventName: string | null;
  snapshot: AuditOsShadowSnapshot;
  structuralDiff: AuditOsShadowDiffResult;
}): Promise<PersistAuditOsShadowSnapshotResult> {
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "service_role_unavailable" };
  }

  if (args.snapshotKind !== "manual_debug" && (!args.reportId || args.reportVersion == null)) {
    return { ok: false, error: "report_id_and_version_required" };
  }

  const sanitized = sanitizeAuditOsShadowPersistPayload({
    snapshot: args.snapshot,
    structuralDiff: args.structuralDiff,
  });

  const row = {
    case_id: args.caseId,
    report_id: args.reportId,
    report_version: args.reportVersion,
    snapshot_kind: args.snapshotKind,
    adapter_versions: sanitized.adapter_versions,
    normalized_scoring: sanitized.normalized_scoring,
    evidence_manifest: sanitized.evidence_manifest,
    normalized_report: sanitized.normalized_report,
    structural_diff: sanitized.structural_diff,
    warnings: sanitized.warnings,
    source_event_name: args.sourceEventName,
    updated_at: new Date().toISOString(),
  };

  try {
    if (args.snapshotKind === "manual_debug") {
      const ins = await admin.from(AUDITOS_SHADOW_SNAPSHOTS_TABLE).insert(row).select("id").maybeSingle();
      if (ins.error) return { ok: false, error: ins.error.message };
      return { ok: true, id: ins.data?.id };
    }

    const existing = await admin
      .from(AUDITOS_SHADOW_SNAPSHOTS_TABLE)
      .select("id")
      .eq("case_id", args.caseId)
      .eq("report_id", args.reportId as string)
      .eq("report_version", args.reportVersion as number)
      .eq("snapshot_kind", args.snapshotKind)
      .maybeSingle();

    if (existing.error) {
      return { ok: false, error: existing.error.message };
    }

    if (existing.data?.id) {
      const up = await admin
        .from(AUDITOS_SHADOW_SNAPSHOTS_TABLE)
        .update({
          adapter_versions: row.adapter_versions,
          normalized_scoring: row.normalized_scoring,
          evidence_manifest: row.evidence_manifest,
          normalized_report: row.normalized_report,
          structural_diff: row.structural_diff,
          warnings: row.warnings,
          source_event_name: row.source_event_name,
          updated_at: row.updated_at,
        })
        .eq("id", existing.data.id);
      if (up.error) return { ok: false, error: up.error.message };
      return { ok: true, id: existing.data.id };
    }

    const ins = await admin.from(AUDITOS_SHADOW_SNAPSHOTS_TABLE).insert(row).select("id").maybeSingle();
    if (ins.error) return { ok: false, error: ins.error.message };
    return { ok: true, id: ins.data?.id };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}
