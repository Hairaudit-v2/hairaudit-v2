import type { UserRole } from "@/lib/roles";
import { dashboardPathForRole } from "@/lib/auth/redirects";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Default path after auth when `next` was not specified.
 * Academy members go to /academy/dashboard so they are not dropped on the patient HairAudit dashboard.
 */
export async function defaultPathAfterAuthNoNext(
  admin: SupabaseClient,
  userId: string,
  profileRole: UserRole
): Promise<string> {
  const { data: academyRow } = await admin
    .from("academy_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (academyRow) return "/academy/dashboard";
  return dashboardPathForRole(profileRole);
}

/**
 * Browser client: where to send a user who already has a session (login page, password sign-in).
 * Uses RLS — users can read their own academy_users row.
 */
export async function browserPathAfterLoginSession(supabase: SupabaseClient): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return "/dashboard";
  const { data: au } = await supabase.from("academy_users").select("user_id").eq("user_id", uid).maybeSingle();
  return au ? "/academy/dashboard" : "/dashboard";
}
