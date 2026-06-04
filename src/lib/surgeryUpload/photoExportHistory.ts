// Stage 8B — read-only surgery photo export history for case participants (no patients).
import type { SupabaseClient } from "@supabase/supabase-js";
import { SURGERY_PHOTO_SLOTS } from "@/lib/surgeryUpload/checklist";

const SLOT_LABELS: Record<string, string> = Object.fromEntries(
  SURGERY_PHOTO_SLOTS.map((s) => [s.key, s.label])
);

export type PhotoExportHistoryItem = {
  id: string;
  createdAt: string;
  actorLabel: string;
  scopeSummary: string;
  photoCount: number;
  status: "completed" | "failed";
  /** Safe, short message for failed exports (no paths). */
  errorSummary: string | null;
};

type RawExportRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  export_scope: string;
  slot_key: string | null;
  photo_count: number;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

function sanitizeExportErrorMessage(raw: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.replace(/\/[^\s]+/g, "[path]").replace(/\\[^\s]+/g, "[path]");
  s = s.trim().slice(0, 240);
  return s || null;
}

function scopeSummaryFromRow(row: RawExportRow): string {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : null;
  const keysFromMeta = meta?.slot_keys;
  const slotKeys =
    Array.isArray(keysFromMeta) && keysFromMeta.every((x) => typeof x === "string")
      ? (keysFromMeta as string[])
      : [];

  const scope = String(row.export_scope ?? "all").toLowerCase();
  if (scope === "all") return "All categories";
  if (scope === "multi_category" || scope === "multi") {
    if (slotKeys.length > 0) {
      return `${slotKeys.length} selected categories`;
    }
    return "Multiple categories";
  }
  if (scope === "category" || scope === "slot") {
    const k = row.slot_key ?? slotKeys[0];
    if (k && typeof k === "string") {
      return `Category: ${SLOT_LABELS[k] ?? k}`;
    }
    return "Single category";
  }
  return "Export";
}

/**
 * Load recent photo export attempts for a case. Caller must already enforce case access.
 */
export async function loadPhotoExportHistory(
  db: SupabaseClient,
  caseId: string,
  limit = 15
): Promise<PhotoExportHistoryItem[]> {
  try {
    const { data, error } = await db
      .from("surgery_upload_photo_exports")
      .select("id, created_at, actor_id, export_scope, slot_key, photo_count, status, error_message, metadata")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50));

    if (error || !data?.length) return [];

    const rows = data as RawExportRow[];
    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id)));
    const profilesById = new Map<string, { display_name?: string | null; role?: string | null }>();
    if (actorIds.length > 0) {
      try {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, display_name, role")
          .in("id", actorIds);
        for (const p of (profiles ?? []) as Array<{
          id: string;
          display_name?: string | null;
          role?: string | null;
        }>) {
          profilesById.set(p.id, { display_name: p.display_name, role: p.role });
        }
      } catch {
        /* optional enrichment */
      }
    }

    return rows.map((row) => {
      const prof = row.actor_id ? profilesById.get(row.actor_id) : undefined;
      const name = prof?.display_name?.trim();
      const actorLabel =
        name ? name.slice(0, 80) : row.actor_id ? "Staff" : "System";
      const st = row.status === "failed" ? "failed" : "completed";
      return {
        id: row.id,
        createdAt: row.created_at,
        actorLabel,
        scopeSummary: scopeSummaryFromRow(row),
        photoCount: typeof row.photo_count === "number" ? row.photo_count : 0,
        status: st,
        errorSummary: st === "failed" ? sanitizeExportErrorMessage(row.error_message) : null,
      };
    });
  } catch {
    return [];
  }
}
