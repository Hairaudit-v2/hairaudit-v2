import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrainingCaseCorrectionType } from "./constants";

export type CorrectionAuditEntry = {
  training_case_id: string;
  changed_by: string;
  correction_type: TrainingCaseCorrectionType;
  field_name?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  reason?: string | null;
};

export async function recordTrainingCaseCorrection(
  supabase: SupabaseClient,
  entry: CorrectionAuditEntry
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("training_case_corrections").insert({
    training_case_id: entry.training_case_id,
    changed_by: entry.changed_by,
    correction_type: entry.correction_type,
    field_name: entry.field_name ?? null,
    old_value: entry.old_value !== undefined ? entry.old_value : null,
    new_value: entry.new_value !== undefined ? entry.new_value : null,
    reason: entry.reason ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function recordFieldCorrections(
  supabase: SupabaseClient,
  params: {
    caseId: string;
    userId: string;
    correctionType: TrainingCaseCorrectionType;
    reason: string;
    changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const c of params.changes) {
    const res = await recordTrainingCaseCorrection(supabase, {
      training_case_id: params.caseId,
      changed_by: params.userId,
      correction_type: params.correctionType,
      field_name: c.field,
      old_value: c.oldValue,
      new_value: c.newValue,
      reason: params.reason,
    });
    if (!res.ok) return res;
  }
  return { ok: true };
}

export type TrainingCaseCorrectionRow = {
  id: string;
  training_case_id: string;
  changed_by: string | null;
  correction_type: string;
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  created_at: string;
};

export async function fetchTrainingCaseCorrections(
  supabase: SupabaseClient,
  caseId: string
): Promise<TrainingCaseCorrectionRow[]> {
  const { data, error } = await supabase
    .from("training_case_corrections")
    .select("*")
    .eq("training_case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TrainingCaseCorrectionRow[];
}
