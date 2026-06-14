/**
 * Stage 4C — load persisted shadow rows for auditor UI (service role after app-level auditor check).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AUDITOS_SHADOW_SNAPSHOTS_TABLE, type AuditOsShadowSnapshotKind } from "./persistAuditOsShadowSnapshot.server";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type AuditOsShadowSnapshotListItem = {
  id: string;
  snapshotKind: AuditOsShadowSnapshotKind;
  reportVersion: number | null;
  createdAt: string;
  updatedAt: string;
  diffStatus: string | null;
  warningsCount: number;
  sourceEventName: string | null;
};

/** Pure helper for tests — only HairAudit auditors may load persisted shadow rows via server loader. */
export function canLoadAuditOsShadowSnapshotsForRole(role: string | null | undefined): boolean {
  return role === "auditor";
}

/** Pure helper — review panel is only intended for HairAudit auditors (not patients/clinics/doctors). */
export function canShowAuditOsReviewPanelForRole(role: string | null | undefined): boolean {
  return role === "auditor";
}

export type AuditOsPersistedShadowBlob = {
  id: string;
  snapshotKind: AuditOsShadowSnapshotKind;
  reportVersion: number | null;
  createdAt: string;
  updatedAt: string;
  adapterVersions: Record<string, unknown>;
  normalizedScoring: unknown;
  evidenceManifest: unknown;
  normalizedReport: unknown;
  structuralDiff: unknown;
  warnings: string[];
  sourceEventName: string | null;
};

/**
 * Latest persisted shadow row including JSON blobs (auditor-only; service role after role check).
 */
export async function loadLatestPersistedAuditOsShadowBlobForAuditor(args: {
  sessionSupabase: SupabaseClient;
  caseId: string;
  resolvedRole: string;
}): Promise<AuditOsPersistedShadowBlob | null> {
  void args.sessionSupabase;
  if (!canLoadAuditOsShadowSnapshotsForRole(args.resolvedRole)) return null;

  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from(AUDITOS_SHADOW_SNAPSHOTS_TABLE)
    .select(
      "id, snapshot_kind, report_version, created_at, updated_at, adapter_versions, normalized_scoring, evidence_manifest, normalized_report, structural_diff, warnings, source_event_name"
    )
    .eq("case_id", args.caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !isRecord(data)) return null;

  const av = data.adapter_versions;
  return {
    id: String(data.id),
    snapshotKind: data.snapshot_kind as AuditOsShadowSnapshotKind,
    reportVersion: data.report_version != null ? Number(data.report_version) : null,
    createdAt: String(data.created_at ?? ""),
    updatedAt: String(data.updated_at ?? ""),
    adapterVersions: isRecord(av) ? av : {},
    normalizedScoring: data.normalized_scoring ?? null,
    evidenceManifest: data.evidence_manifest ?? null,
    normalizedReport: data.normalized_report ?? null,
    structuralDiff: data.structural_diff ?? null,
    warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
    sourceEventName: data.source_event_name != null ? String(data.source_event_name) : null,
  };
}

/** Exported for Stage 4D review UI — reads persisted `structural_diff.status` only. */
export function structuralDiffStatusFromJson(structuralDiff: unknown): string | null {
  if (!structuralDiff || typeof structuralDiff !== "object") return null;
  const s = (structuralDiff as Record<string, unknown>).status;
  return typeof s === "string" ? s : null;
}

/**
 * Returns recent persisted shadow rows for a case when the caller is an auditor.
 * Uses service role only after `resolvedRole === "auditor"` (must be computed server-side).
 */
export async function loadAuditOsShadowSnapshotsForAuditor(args: {
  /** Reserved for future RLS-backed reads. */
  sessionSupabase: SupabaseClient;
  caseId: string;
  resolvedRole: string;
  limit?: number;
}): Promise<AuditOsShadowSnapshotListItem[]> {
  void args.sessionSupabase;
  if (!canLoadAuditOsShadowSnapshotsForRole(args.resolvedRole)) return [];

  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return [];

  const lim = Math.min(Math.max(args.limit ?? 12, 1), 50);

  const { data, error } = await admin
    .from(AUDITOS_SHADOW_SNAPSHOTS_TABLE)
    .select("id, snapshot_kind, report_version, created_at, updated_at, warnings, structural_diff, source_event_name")
    .eq("case_id", args.caseId)
    .order("created_at", { ascending: false })
    .limit(lim);

  if (error || !Array.isArray(data)) return [];

  return data.map((r) => {
    const warnings = Array.isArray(r.warnings) ? (r.warnings as string[]) : [];
    return {
      id: String(r.id),
      snapshotKind: r.snapshot_kind as AuditOsShadowSnapshotKind,
      reportVersion: r.report_version != null ? Number(r.report_version) : null,
      createdAt: String(r.created_at ?? ""),
      updatedAt: String(r.updated_at ?? ""),
      diffStatus: structuralDiffStatusFromJson(r.structural_diff),
      warningsCount: warnings.length,
      sourceEventName: r.source_event_name != null ? String(r.source_event_name) : null,
    };
  });
}
