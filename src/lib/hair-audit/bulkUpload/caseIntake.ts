import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCaseReadiness } from "./validation";

export async function refreshCaseIntakeStatus(admin: SupabaseClient, caseId: string) {
  const { data: caseRow } = await admin
    .from("cases")
    .select("id, patient_reference, graft_count")
    .eq("id", caseId)
    .maybeSingle();
  if (!caseRow) return;

  const { count } = await admin
    .from("hair_audit_case_images")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);

  const readiness = computeCaseReadiness(
    {
      patient_reference: caseRow.patient_reference ?? "",
      graft_count: caseRow.graft_count,
    },
    count ?? 0
  );

  await admin.from("cases").update({ intake_status: readiness.intakeStatus }).eq("id", caseId);
}
