// Stage 8A — who may download the surgery photo export pack (ZIP).
import type { User } from "@supabase/supabase-js";
import { isAuditor } from "@/lib/auth/isAuditor";
import { parseRole, type UserRole } from "@/lib/roles";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

export type PhotoPackExportRole = "auditor" | "doctor" | "clinic";

/**
 * Resolve whether the user may call the photo-export API. Patients are always excluded.
 */
export async function resolvePhotoPackExportRole(user: User): Promise<PhotoPackExportRole | null> {
  const admin = tryCreateSupabaseAdminClient();
  let profileRole: string | null = null;
  if (admin) {
    const { data } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    profileRole = (data?.role as string | null) ?? null;
  }
  const auditor = isAuditor({ profileRole, userEmail: user.email });
  const role: UserRole = auditor ? "auditor" : parseRole(profileRole);
  if (role === "auditor" || role === "doctor" || role === "clinic") return role;
  return null;
}
