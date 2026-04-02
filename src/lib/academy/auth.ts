import type { User } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { isBetaAllowedUser } from "@/lib/auth/betaAccess";
import type { AcademyUserRole } from "./constants";

export type AcademyAccess =
  | { ok: false; reason: "no_session" | "no_membership" | "beta_blocked" }
  | { ok: true; userId: string; user: User; role: AcademyUserRole; isStaff: boolean };

const STAFF_ROLES: AcademyUserRole[] = ["academy_admin", "trainer", "clinic_staff"];

const KNOWN_ROLES: readonly AcademyUserRole[] = ["academy_admin", "trainer", "clinic_staff", "trainee"];

/**
 * Normalize DB / API role strings (trim, case, hyphen vs underscore) so layout gates stay reliable.
 */
export function parseAcademyUserRole(raw: unknown): AcademyUserRole | null {
  if (raw == null) return null;
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  return (KNOWN_ROLES as readonly string[]).includes(s) ? (s as AcademyUserRole) : null;
}

export function isAcademyAdminRole(role: AcademyUserRole): boolean {
  return role === "academy_admin";
}

/** Signed-in academy members who are not academy_admin are sent here instead of the staff dashboard. */
export const ACADEMY_ADMIN_FORBIDDEN_PATH = "/academy/no-admin-access" as const;

export function academyIsStaffRole(role: AcademyUserRole): boolean {
  return STAFF_ROLES.includes(role);
}

/**
 * Resolve academy membership for the current Supabase session (RLS-aware).
 */
export async function getAcademyAccess(): Promise<AcademyAccess> {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "no_session" };
  if (!(await isBetaAllowedUser(user))) return { ok: false, reason: "beta_blocked" };

  const { data: row, error } = await supabase
    .from("academy_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || row?.role == null) return { ok: false, reason: "no_membership" };

  const role = parseAcademyUserRole(row.role);
  if (!role) return { ok: false, reason: "no_membership" };

  return {
    ok: true,
    userId: user.id,
    user,
    role,
    isStaff: academyIsStaffRole(role),
  };
}

export async function requireAcademyAccess(): Promise<Extract<AcademyAccess, { ok: true }>> {
  const a = await getAcademyAccess();
  if (!a.ok) {
    const err = new Error(a.reason);
    (err as Error & { academyReason?: string }).academyReason = a.reason;
    throw err;
  }
  return a;
}

export async function requireAcademyStaff(): Promise<Extract<AcademyAccess, { ok: true }>> {
  const a = await requireAcademyAccess();
  if (!a.isStaff) {
    const err = new Error("staff_only");
    (err as Error & { academyReason?: string }).academyReason = "staff_only";
    throw err;
  }
  return a;
}

export async function requireAcademyAdmin(): Promise<Extract<AcademyAccess, { ok: true }>> {
  const a = await requireAcademyAccess();
  if (!isAcademyAdminRole(a.role)) {
    const err = new Error("academy_admin_only");
    (err as Error & { academyReason?: string }).academyReason = "academy_admin_only";
    throw err;
  }
  return a;
}
