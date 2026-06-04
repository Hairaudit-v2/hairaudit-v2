// Stage 8C — batch profile resolution for export manifests (server / API routes).
import type { SupabaseClient } from "@supabase/supabase-js";
import { staffDisplayLabelFromProfile } from "@/lib/surgeryUpload/photoExportStaffDisplay";

/**
 * Batch-load profiles and return userId → display label (best-effort).
 */
export async function batchStaffDisplayLabels(
  db: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(userIds.filter((id) => typeof id === "string" && id.length > 0)));
  if (unique.length === 0) return out;
  try {
    const { data, error } = await db.from("profiles").select("id, display_name, role").in("id", unique);
    if (error || !data) return out;
    for (const p of data as Array<{ id: string; display_name?: string | null; role?: string | null }>) {
      out.set(p.id, staffDisplayLabelFromProfile(p));
    }
  } catch {
    /* best-effort */
  }
  for (const id of unique) {
    if (!out.has(id)) out.set(id, "");
  }
  return out;
}
