import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrainingCaseRow, TrainingDoctorRow } from "./types";

export async function fetchTrainingDoctorForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<TrainingDoctorRow | null> {
  const { data, error } = await supabase
    .from("training_doctors")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as TrainingDoctorRow;
}

export async function fetchTrainingCasesForDoctor(
  supabase: SupabaseClient,
  doctorId: string
): Promise<TrainingCaseRow[]> {
  const { data, error } = await supabase
    .from("training_cases")
    .select("*")
    .eq("training_doctor_id", doctorId)
    .order("surgery_date", { ascending: true });
  if (error || !data) return [];
  return data as TrainingCaseRow[];
}
