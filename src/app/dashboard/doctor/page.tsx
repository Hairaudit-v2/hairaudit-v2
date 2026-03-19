import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  evaluateCertification,
  certificationResultToProgress,
  type CaseWithReportForCert,
  type CaseRowForCert,
} from "@/lib/certification";
import { getCertificationProgress } from "@/lib/certificationProgress";
import DoctorDashboardProduction from "./DoctorDashboardProduction";

export default async function DoctorDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: cases } = await admin
    .from("cases")
    .select("id, title, status, created_at, submitted_at, evidence_score_doctor, doctor_id, audit_mode, visibility_scope")
    .or(`doctor_id.eq.${user.id},clinic_id.eq.${user.id},user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  const caseList = cases ?? [];
  const caseIds = caseList.map((c) => c.id);

  const doctorAttributedCases = caseList.filter(
    (c) => (c as { doctor_id?: string | null }).doctor_id === user.id
  );
  const doctorCaseIds = doctorAttributedCases.map((c) => c.id).filter(Boolean);
  let doctorLatestReportsByCaseId: Map<string, { summary: unknown }> = new Map();
  if (doctorCaseIds.length > 0) {
    const { data: doctorReportRows } = await admin
      .from("reports")
      .select("case_id, version, summary")
      .in("case_id", doctorCaseIds)
      .order("version", { ascending: false });
    for (const r of doctorReportRows ?? []) {
      const cid = String(r.case_id ?? "");
      if (!cid || doctorLatestReportsByCaseId.has(cid)) continue;
      doctorLatestReportsByCaseId.set(cid, { summary: (r as { summary?: unknown }).summary });
    }
  }
  const doctorCasesWithReports: CaseWithReportForCert[] = doctorAttributedCases.map((c) => ({
    case: {
      id: c.id,
      status: c.status,
      audit_mode: (c as { audit_mode?: string | null }).audit_mode,
      visibility_scope: (c as { visibility_scope?: string | null }).visibility_scope,
    } as CaseRowForCert,
    latestReportSummary: doctorLatestReportsByCaseId.get(c.id)?.summary as CaseWithReportForCert["latestReportSummary"],
  }));
  const doctorCertResult = evaluateCertification(doctorCasesWithReports);
  const doctorCertProgressMapped = certificationResultToProgress(doctorCertResult);
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

  const doctorCertProgress = {
    currentTier: doctorCertProgressMapped.currentTier as "Active" | "Silver" | "Gold" | "Platinum",
    nextTier: doctorCertProgressMapped.nextTier as "Active" | "Silver" | "Gold" | "Platinum" | null,
    currentCount: doctorCertProgressMapped.currentCount,
    nextTierThreshold: doctorCertProgressMapped.nextTierThreshold,
    progressPct: doctorCertProgressMapped.progressPct,
    casesToNext: doctorCertProgressMapped.casesToNext,
    guidanceText: doctorCertProgressMapped.guidanceText,
  };

  return (
    <DoctorDashboardProduction
      cases={caseList}
      caseIdsWithUploads={caseIdsWithUploads}
      participationApprovalStatus={participationApprovalStatus}
      participationSummary={participationSummary}
      showWelcomeBanner={showDoctorWelcomeBanner}
      profileCompleteness={{ percentage: doctorCompletenessPct, doneCount: doctorDoneCount, totalChecks: doctorTotalChecks, nextActions: doctorNextActions.slice(0, 3), nextBestStep: doctorNextBestStep }}
      certificationProgress={doctorCertProgress}
      certificationResult={doctorCertResult}
    />
  );
}
