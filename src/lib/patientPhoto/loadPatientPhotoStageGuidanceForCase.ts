import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizedPatientAnswersFromReportRow } from "@/lib/patient/answersFromReportRow";
import { isPatientPhotoStageGuidanceEnabled } from "@/lib/features/enablePatientPhotoStageGuidance";
import {
  buildPatientPhotoUploadGuidancePanel,
  type PatientPhotoUploadGuidancePanel,
} from "@/lib/patientPhoto/patientPhotoUploadGuidance";

/**
 * Server-only: intake-driven upload guidance when NEXT_PUBLIC_ENABLE_PATIENT_PHOTO_STAGE_GUIDANCE is true.
 * Returns null when the flag is off (no extra query).
 */
export async function loadPatientPhotoStageGuidanceForCase(
  supabase: SupabaseClient,
  caseId: string
): Promise<PatientPhotoUploadGuidancePanel | null> {
  if (!isPatientPhotoStageGuidanceEnabled()) return null;

  const { data: report } = await supabase
    .from("reports")
    .select("summary, patient_audit_version, patient_audit_v2")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const answers = normalizedPatientAnswersFromReportRow(report);
  return buildPatientPhotoUploadGuidancePanel(answers);
}
