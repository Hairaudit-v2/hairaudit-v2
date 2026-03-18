import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import DoctorDashboardProduction from "./DoctorDashboardProduction";

export default async function DoctorDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: cases } = await admin
    .from("cases")
    .select("id, title, status, created_at, submitted_at, evidence_score_doctor")
    .or(`doctor_id.eq.${user.id},clinic_id.eq.${user.id},user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  const caseList = cases ?? [];
  const caseIds = caseList.map((c) => c.id);
  let caseIdsWithUploads: string[] = [];
  if (caseIds.length > 0) {
    const { data: uploadRows } = await admin
      .from("uploads")
      .select("case_id")
      .in("case_id", caseIds);
    caseIdsWithUploads = [...new Set((uploadRows ?? []).map((r) => String(r.case_id ?? "")).filter(Boolean))];
  }

  const { data: doctorProfile } = await admin
    .from("doctor_profiles")
    .select("participation_approval_status")
    .eq("linked_user_id", user.id)
    .limit(1)
    .maybeSingle();

  const participationApprovalStatus = (doctorProfile?.participation_approval_status as "not_started" | "pending_review" | "approved" | "more_info_required") ?? "not_started";

  return (
    <DoctorDashboardProduction
      cases={caseList}
      caseIdsWithUploads={caseIdsWithUploads}
      participationApprovalStatus={participationApprovalStatus}
    />
  );
}
