/**
 * Save patient, doctor, or clinic answers to reports table (draft).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubmissionType } from "../config/canonicalMappings";

export async function savePatientAnswers(
  supabase: SupabaseClient,
  caseId: string,
  patientAnswers: Record<string, unknown>
): Promise<void> {
  const summary = {
    patient_answers: patientAnswers,
    patient_answers_updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from("reports")
    .select("id, summary")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const updatePayload = {
    summary: { ...(existing?.summary as object ?? {}), ...summary },
    patient_audit_version: 2,
    patient_audit_v2: patientAnswers,
  };

  if (existing) {
    const { error } = await supabase.from("reports").update(updatePayload).eq("id", existing.id);
    if (error) throw new Error(`savePatientAnswers update: ${error.message}`);
    return;
  }

  const { error } = await supabase.from("reports").insert({
    case_id: caseId,
    version: 1,
    summary: summary,
    pdf_path: "",
    patient_audit_version: 2,
    patient_audit_v2: patientAnswers,
  });
  if (error) throw new Error(`savePatientAnswers insert: ${error.message}`);
}

export async function saveDoctorAnswers(
  supabase: SupabaseClient,
  caseId: string,
  doctorAnswers: Record<string, unknown>
): Promise<void> {
  const summary = {
    doctor_answers: doctorAnswers,
    doctor_answers_updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from("reports")
    .select("id, summary")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSummary = { ...(existing?.summary as object ?? {}), ...summary };

  if (existing) {
    const { error } = await supabase.from("reports").update({ summary: nextSummary }).eq("id", existing.id);
    if (error) throw new Error(`saveDoctorAnswers update: ${error.message}`);
    return;
  }

  const { error } = await supabase.from("reports").insert({
    case_id: caseId,
    version: 1,
    summary: nextSummary,
    pdf_path: "",
  });
  if (error) throw new Error(`saveDoctorAnswers insert: ${error.message}`);
}

export async function saveClinicAnswers(
  supabase: SupabaseClient,
  caseId: string,
  clinicAnswers: Record<string, unknown>
): Promise<void> {
  const summary = {
    clinic_answers: clinicAnswers,
    clinic_answers_updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from("reports")
    .select("id, summary")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSummary = { ...(existing?.summary as object ?? {}), ...summary };

  if (existing) {
    const { error } = await supabase.from("reports").update({ summary: nextSummary }).eq("id", existing.id);
    if (error) throw new Error(`saveClinicAnswers update: ${error.message}`);
    return;
  }

  const { error } = await supabase.from("reports").insert({
    case_id: caseId,
    version: 1,
    summary: nextSummary,
    pdf_path: "",
  });
  if (error) throw new Error(`saveClinicAnswers insert: ${error.message}`);
}

export async function saveAnswersForType(
  supabase: SupabaseClient,
  caseId: string,
  submissionType: SubmissionType,
  answers: Record<string, unknown>
): Promise<void> {
  switch (submissionType) {
    case "patient":
      return savePatientAnswers(supabase, caseId, answers);
    case "doctor":
      return saveDoctorAnswers(supabase, caseId, answers);
    case "clinic":
      return saveClinicAnswers(supabase, caseId, answers);
    default:
      throw new Error(`Unknown submission type: ${submissionType}`);
  }
}
