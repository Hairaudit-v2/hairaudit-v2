import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole } from "./roles";

export async function getUserRole(userId: string): Promise<"patient" | "doctor" | "clinic" | "auditor"> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role) return parseRole(data.role);
  return "patient";
}

export async function canAccessCase(
  userId: string,
  caseRow: { user_id?: string; patient_id?: string | null; doctor_id?: string | null; clinic_id?: string | null } | null
): Promise<boolean> {
  if (!caseRow) return false;
  if (caseRow.user_id === userId || caseRow.patient_id === userId || caseRow.doctor_id === userId || caseRow.clinic_id === userId) return true;
  const role = await getUserRole(userId);
  if (role === "auditor") return true;
  return false;
}
