import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseRowForPostOpGuide } from "@/lib/patient/caseSubmitStatus";

export type PatientCaseRowWithId = CaseRowForPostOpGuide & {
  id: string;
  title?: string | null;
  created_at?: string;
};

/**
 * Same case scope as the patient dashboard: rows visible to the patient for guide eligibility.
 */
export async function fetchPatientCasesForPostOpGuide(
  admin: SupabaseClient,
  userId: string
): Promise<PatientCaseRowWithId[]> {
  const { data: cases } = await admin
    .from("cases")
    .select("id, title, status, created_at, submitted_at, audit_type")
    .or(`patient_id.eq.${userId},and(user_id.eq.${userId},patient_id.is.null)`)
    .order("created_at", { ascending: false });
  return (cases ?? []) as PatientCaseRowWithId[];
}
