import type { User } from "@supabase/supabase-js";
import { parseRole } from "@/lib/roles";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";

export async function getEffectiveUserRole(user: User): Promise<"patient" | "doctor" | "clinic" | "auditor"> {
  const admin = tryCreateSupabaseAdminClient();
  if (admin) {
    const { data } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (isAuditor({ profileRole: data?.role, userEmail: user.email })) return "auditor";
    if (data?.role) return parseRole(data.role);
  }
  if (isAuditor({ userEmail: user.email })) return "auditor";
  return parseRole((user.user_metadata as Record<string, unknown> | undefined)?.role);
}

export async function isPatientUser(user: User): Promise<boolean> {
  const role = await getEffectiveUserRole(user);
  return role === "patient";
}

export async function isBetaAllowedUser(user: User): Promise<boolean> {
  const role = await getEffectiveUserRole(user);
  return role === "patient" || role === "auditor";
}
