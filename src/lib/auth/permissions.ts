import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { canAccessCase } from "@/lib/case-access";
import { isAuditor } from "@/lib/auth/isAuditor";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

export type CaseAccessRow = {
  id: string;
  user_id?: string | null;
  patient_id?: string | null;
  doctor_id?: string | null;
  clinic_id?: string | null;
};

export type AuthSuccess<T> = { ok: true; data: T };
export type AuthFailure = { ok: false; response: NextResponse };
export type AuthResult<T> = AuthSuccess<T> | AuthFailure;

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * Cookie-aware Supabase user (App Router / RLS). Returns 401 when unauthenticated.
 */
export async function requireUser(supabaseAuth: SupabaseClient): Promise<AuthResult<{ user: User }>> {
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();
  if (error || !user) {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }
  return { ok: true, data: { user } };
}

function caseSelect() {
  return "id, user_id, patient_id, doctor_id, clinic_id" as const;
}

/**
 * Loads the case (admin preferred for consistency with other signed-url routes) and enforces {@link canAccessCase}.
 */
export async function requireCaseAccess(args: {
  userId: string;
  caseId: string;
  supabaseAuth: SupabaseClient;
}): Promise<AuthResult<{ case: CaseAccessRow }>> {
  const admin = tryCreateSupabaseAdminClient();
  const db = admin ?? args.supabaseAuth;

  const { data: c, error } = await db
    .from("cases")
    .select(caseSelect())
    .eq("id", args.caseId)
    .maybeSingle();

  if (error) {
    console.error("[permissions] requireCaseAccess case lookup error", { caseId: args.caseId, message: error.message });
  }

  if (!c) {
    return { ok: false, response: jsonError(404, "Case not found") };
  }

  const allowed = await canAccessCase(args.userId, c);
  if (!allowed) {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }

  return { ok: true, data: { case: c as CaseAccessRow } };
}

export function isPatientCaseParticipant(userId: string, caseRow: CaseAccessRow): boolean {
  return caseRow.user_id === userId || caseRow.patient_id === userId;
}

export function isDoctorCaseParticipant(userId: string, caseRow: CaseAccessRow): boolean {
  return caseRow.doctor_id === userId;
}

export function isClinicCaseParticipant(userId: string, caseRow: CaseAccessRow): boolean {
  return caseRow.clinic_id === userId;
}

export function requirePatientCaseAccess(userId: string, caseRow: CaseAccessRow | null): AuthResult<{ case: CaseAccessRow }> {
  if (!caseRow) return { ok: false, response: jsonError(404, "Case not found") };
  if (!isPatientCaseParticipant(userId, caseRow)) {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }
  return { ok: true, data: { case: caseRow } };
}

export function requireDoctorCaseAccess(userId: string, caseRow: CaseAccessRow | null): AuthResult<{ case: CaseAccessRow }> {
  if (!caseRow) return { ok: false, response: jsonError(404, "Case not found") };
  if (!isDoctorCaseParticipant(userId, caseRow)) {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }
  return { ok: true, data: { case: caseRow } };
}

export function requireClinicCaseAccess(userId: string, caseRow: CaseAccessRow | null): AuthResult<{ case: CaseAccessRow }> {
  if (!caseRow) return { ok: false, response: jsonError(404, "Case not found") };
  if (!isClinicCaseParticipant(userId, caseRow)) {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }
  return { ok: true, data: { case: caseRow } };
}

/**
 * Auditor portal / admin-style gates. Uses profile role plus the same email override policy as {@link isAuditor}.
 */
export async function requireAuditor(args: { userId: string; userEmail: string | undefined }): Promise<AuthResult<{ profileRole: string | null }>> {
  const admin = tryCreateSupabaseAdminClient();
  let profileRole: string | null = null;
  if (admin) {
    const { data } = await admin.from("profiles").select("role").eq("id", args.userId).maybeSingle();
    profileRole = (data?.role as string | undefined) ?? null;
  }
  if (!isAuditor({ profileRole, userEmail: args.userEmail })) {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }
  return { ok: true, data: { profileRole } };
}

/**
 * Patient (owner) access to a case — identity on the case row, without auditor-wide access.
 */
export async function requirePatientCaseAccessByCaseId(args: {
  userId: string;
  caseId: string;
  supabaseAuth: SupabaseClient;
}): Promise<AuthResult<{ case: CaseAccessRow }>> {
  const admin = tryCreateSupabaseAdminClient();
  const db = admin ?? args.supabaseAuth;
  const { data: c, error } = await db.from("cases").select(caseSelect()).eq("id", args.caseId).maybeSingle();
  if (error) {
    console.error("[permissions] requirePatientCaseAccessByCaseId", { caseId: args.caseId, message: error.message });
  }
  return requirePatientCaseAccess(args.userId, c as CaseAccessRow | null);
}

export async function requireDoctorCaseAccessByCaseId(args: {
  userId: string;
  caseId: string;
  supabaseAuth: SupabaseClient;
}): Promise<AuthResult<{ case: CaseAccessRow }>> {
  const admin = tryCreateSupabaseAdminClient();
  const db = admin ?? args.supabaseAuth;
  const { data: c, error } = await db.from("cases").select(caseSelect()).eq("id", args.caseId).maybeSingle();
  if (error) {
    console.error("[permissions] requireDoctorCaseAccessByCaseId", { caseId: args.caseId, message: error.message });
  }
  return requireDoctorCaseAccess(args.userId, c as CaseAccessRow | null);
}

export async function requireClinicCaseAccessByCaseId(args: {
  userId: string;
  caseId: string;
  supabaseAuth: SupabaseClient;
}): Promise<AuthResult<{ case: CaseAccessRow }>> {
  const admin = tryCreateSupabaseAdminClient();
  const db = admin ?? args.supabaseAuth;
  const { data: c, error } = await db.from("cases").select(caseSelect()).eq("id", args.caseId).maybeSingle();
  if (error) {
    console.error("[permissions] requireClinicCaseAccessByCaseId", { caseId: args.caseId, message: error.message });
  }
  return requireClinicCaseAccess(args.userId, c as CaseAccessRow | null);
}
