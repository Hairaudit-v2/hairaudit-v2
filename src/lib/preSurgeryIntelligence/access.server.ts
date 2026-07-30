/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Authorised clinician / auditor gate.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { canAccessCase } from "@/lib/case-access";
import type { AuthResult } from "@/lib/auth/permissions";
import { decidePreSurgeryClinicianAccess } from "./accessPolicy";

export type PreSurgeryClinicianContext = {
  user: User;
  admin: SupabaseClient;
  profileRole: string | null;
  caseRow: {
    id: string;
    user_id: string | null;
    patient_id: string | null;
    doctor_id: string | null;
    clinic_id: string | null;
    patient_review_pathway: string | null;
  };
  isAuditor: boolean;
  accessRole: "auditor" | "assigned_doctor" | "assigned_clinic";
};

/**
 * Auditors, or case-assigned doctor/clinic — never patient-only or unrelated professional access.
 */
export async function requirePreSurgeryClinicianAccess(
  caseId: string
): Promise<AuthResult<PreSurgeryClinicianContext>> {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const auditor = isAuditor({ profileRole: profile?.role, userEmail: user.email });

  const { data: caseRow, error } = await admin
    .from("cases")
    .select("id, user_id, patient_id, doctor_id, clinic_id, patient_review_pathway")
    .eq("id", caseId)
    .maybeSingle();

  if (error || !caseRow) {
    return { ok: false, response: NextResponse.json({ error: "Case not found" }, { status: 404 }) };
  }

  // Case visibility is necessary but not sufficient — professional planning is narrower.
  if (!(await canAccessCase(user.id, caseRow))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const decision = decidePreSurgeryClinicianAccess({
    userId: user.id,
    isAuditor: auditor,
    caseUserId: caseRow.user_id,
    casePatientId: caseRow.patient_id,
    caseDoctorId: caseRow.doctor_id,
    caseClinicId: caseRow.clinic_id,
  });

  if (!decision.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Forbidden: clinician or auditor access required",
          reason: decision.reason,
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    data: {
      user,
      admin,
      profileRole: profile?.role ?? null,
      caseRow,
      isAuditor: auditor,
      accessRole: decision.role,
    },
  };
}
