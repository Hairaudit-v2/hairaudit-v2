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
    .select("id, participation_approval_status")
    .eq("linked_user_id", user.id)
    .limit(1)
    .maybeSingle();

  // Onboarding-first: send doctor users to onboarding when no profile (only from dashboard entry)
  if (!doctorProfile) {
    redirect("/dashboard/doctor/onboarding");
  }

  const participationApprovalStatus = (doctorProfile?.participation_approval_status as "not_started" | "pending_review" | "approved" | "more_info_required") ?? "not_started";

  const casesSubmittedCount = caseList.filter(
    (c) => c.submitted_at != null || String(c.status ?? "") === "submitted"
  ).length;

  let reportsCompletedCount = 0;
  let benchmarkReadyCount = 0;
  if (caseIds.length > 0) {
    const { data: reportRows } = await admin
      .from("reports")
      .select("case_id, version, status, counts_for_awards")
      .in("case_id", caseIds)
      .eq("status", "complete")
      .order("version", { ascending: false });
    const byCase = new Map<string, { version: number; counts_for_awards: boolean | null }>();
    for (const r of reportRows ?? []) {
      const cid = String(r.case_id ?? "");
      if (!cid || byCase.has(cid)) continue;
      byCase.set(cid, {
        version: Number(r.version ?? 0),
        counts_for_awards: (r as { counts_for_awards?: boolean | null }).counts_for_awards ?? null,
      });
    }
    reportsCompletedCount = byCase.size;
    benchmarkReadyCount = [...byCase.values()].filter((v) => v.counts_for_awards === true).length;
  }

  const participationSummary = {
    casesSubmittedCount,
    reportsCompletedCount,
    benchmarkReadyCount,
  };

  return (
    <DoctorDashboardProduction
      cases={caseList}
      caseIdsWithUploads={caseIdsWithUploads}
      participationApprovalStatus={participationApprovalStatus}
      participationSummary={participationSummary}
    />
  );
}
