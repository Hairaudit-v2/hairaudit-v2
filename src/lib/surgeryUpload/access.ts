// HairAudit Mobile Surgery Upload Portal — access control helpers (Stage 1)
import type { User } from "@supabase/supabase-js";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { parseRole, type UserRole } from "@/lib/roles";

export type SurgeryUploadRole = "doctor" | "clinic" | "auditor";

/** Roles permitted to use the surgery upload portal. Patients are excluded. */
const ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["doctor", "clinic", "auditor"]);

export type SurgeryUploadActor = {
  allowed: boolean;
  role: UserRole;
  isAuditor: boolean;
};

/**
 * Resolve the effective HairAudit role for a user and whether they may use the
 * surgery upload portal. Reuses profiles.role + the auditor email fallback.
 */
export async function resolveSurgeryUploadActor(user: User): Promise<SurgeryUploadActor> {
  const admin = tryCreateSupabaseAdminClient();
  let profileRole: string | null = null;
  if (admin) {
    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profileRole = (data?.role as string | null) ?? null;
  }

  const auditor = isAuditor({ profileRole, userEmail: user.email });
  const role: UserRole = auditor ? "auditor" : parseRole(profileRole);

  return {
    allowed: ALLOWED_ROLES.has(role),
    role,
    isAuditor: auditor,
  };
}
