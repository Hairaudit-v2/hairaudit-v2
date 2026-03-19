import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCertificationProgress } from "@/lib/certificationProgress";
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
    .select("id, participation_approval_status, created_at, doctor_name, doctor_email, years_experience, clinic_profile_id")
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

  const doctorProfileCreatedAt = (doctorProfile as { created_at?: string } | null)?.created_at;
  const showDoctorWelcomeBanner =
    !!doctorProfileCreatedAt &&
    Date.now() - new Date(doctorProfileCreatedAt).getTime() < 24 * 60 * 60 * 1000;

  // Profile completeness (existing doctor_profiles data only)
  const doc = doctorProfile as {
    doctor_name?: string | null;
    doctor_email?: string | null;
    years_experience?: number | null;
    clinic_profile_id?: string | null;
  } | null;
  const hasDoctorName = String(doc?.doctor_name ?? "").trim().length > 0;
  const hasDoctorEmail = String(doc?.doctor_email ?? "").trim().length > 0;
  const hasYearsExperience = doc?.years_experience != null;
  const hasClinicAffiliation = doc?.clinic_profile_id != null && String(doc.clinic_profile_id).trim().length > 0;
  const hasDoctorCase = caseList.length > 0;
  const doctorChecks = [hasDoctorName, hasDoctorEmail, hasYearsExperience, hasClinicAffiliation, hasDoctorCase];
  const doctorDoneCount = doctorChecks.filter(Boolean).length;
  const doctorTotalChecks = doctorChecks.length;
  const doctorCompletenessPct = doctorTotalChecks ? Math.round((doctorDoneCount / doctorTotalChecks) * 100) : 0;
  const doctorNextActions: Array<{ label: string; href: string }> = [];
  if (!hasDoctorName || !hasDoctorEmail || !hasYearsExperience)
    doctorNextActions.push({ label: "Complete your profile", href: "/dashboard/doctor/onboarding" });
  if (!hasDoctorCase) doctorNextActions.push({ label: "Submit your first case", href: "/dashboard/doctor" });
  if (doctorDoneCount === doctorTotalChecks)
    doctorNextActions.push({ label: "Build more verified proof", href: "/dashboard/doctor" });
  const doctorNextBestStep =
    doctorNextActions[0] ?? { label: "Explore your dashboard", href: "/dashboard/doctor" };

  const doctorCertProgress = getCertificationProgress(caseList.length);

  return (
    <DoctorDashboardProduction
      cases={caseList}
      caseIdsWithUploads={caseIdsWithUploads}
      participationApprovalStatus={participationApprovalStatus}
      participationSummary={participationSummary}
      showWelcomeBanner={showDoctorWelcomeBanner}
      profileCompleteness={{ percentage: doctorCompletenessPct, doneCount: doctorDoneCount, totalChecks: doctorTotalChecks, nextActions: doctorNextActions.slice(0, 3), nextBestStep: doctorNextBestStep }}
      certificationProgress={doctorCertProgress}
    />
  );
}
