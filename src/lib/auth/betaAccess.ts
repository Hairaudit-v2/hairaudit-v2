import type { User } from "@supabase/supabase-js";
import { parseRole } from "@/lib/roles";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getEffectiveUserRole(user: User): Promise<"patient" | "doctor" | "clinic" | "auditor"> {
  const admin = tryCreateSupabaseAdminClient();
  if (admin) {
    const { data } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (data?.role) return parseRole(data.role);
  }
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
