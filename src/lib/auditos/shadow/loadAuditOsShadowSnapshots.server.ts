/**
 * Stage 4C — load persisted shadow rows for auditor UI (service role after app-level auditor check).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AUDITOS_SHADOW_SNAPSHOTS_TABLE, type AuditOsShadowSnapshotKind } from "./persistAuditOsShadowSnapshot.server";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

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

function diffStatusFromRow(structuralDiff: unknown): string | null {
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
      diffStatus: diffStatusFromRow(r.structural_diff),
      warningsCount: warnings.length,
      sourceEventName: r.source_event_name != null ? String(r.source_event_name) : null,
    };
  });
}
