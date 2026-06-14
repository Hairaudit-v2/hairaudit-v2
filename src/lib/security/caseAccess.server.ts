/**
 * Stage 3B: consolidated server-side helpers for case-scoped uploads and storage signing.
 * Builds on `@/lib/auth/permissions` — keep route handlers thin and consistent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  requireUser,
  requireCaseAccess,
  requireAuditor,
  type AuthResult,
  type CaseAccessRow,
} from "@/lib/auth/permissions";
import { storagePathBelongsToCase } from "@/lib/uploads/caseFilesPath";

export type { AuthResult, CaseAccessRow };

/** Cookie-aware Supabase user; 401 when unauthenticated. */
export const requireAuthenticatedUser = requireUser;

export { requireCaseAccess };

/**
 * Auditor portal gate (profile role + same email override policy as {@link requireAuditor}).
 */
export async function requireAuditorAccess(
  supabaseAuth: SupabaseClient
): Promise<AuthResult<{ user: User; profileRole: string | null }>> {
  const userGate = await requireUser(supabaseAuth);
  if (!userGate.ok) return userGate;
  const user = userGate.data.user;
  const audi = await requireAuditor({ userId: user.id, userEmail: user.email ?? undefined });
  if (!audi.ok) return audi;
  return { ok: true, data: { user, profileRole: audi.data.profileRole } };
}

/**
 * Case access limited to the assigned doctor or clinic account (not patient owner, not arbitrary users).
 * Auditors do not pass this gate — use {@link requireCaseAccess} when read-only auditor access is intended.
 */
export async function requireClinicOrDoctorCaseAccess(args: {
  userId: string;
  caseId: string;
  supabaseAuth: SupabaseClient;
}): Promise<AuthResult<{ case: CaseAccessRow }>> {
  const gate = await requireCaseAccess(args);
  if (!gate.ok) return gate;
  const c = gate.data.case;
  const uid = args.userId;
  if (c.doctor_id === uid || c.clinic_id === uid) {
    return gate;
  }
  return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}

/** Storage path must resolve to the same case UUID (cases/… or audit_photos/… layout). */
export function assertStoragePathBelongsToCase(path: string, caseId: string): boolean {
  return storagePathBelongsToCase(caseId, path);
}
