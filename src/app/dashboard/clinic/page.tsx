import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import CreateCaseButton from "../create-case-button";
import Sparkline from "@/components/ui/Sparkline";
import { getNextMilestoneFromProfile, getNextTier } from "@/lib/transparency/awardRules";
import ClinicTransparencyProgressPanel from "@/components/dashboard/ClinicTransparencyProgressPanel";
import ClinicFeedbackPanel from "@/components/dashboard/ClinicFeedbackPanel";
import ClinicBadgeWidgetSection from "@/components/dashboard/ClinicBadgeWidgetSection";
import { buildClinicProgressSteps, computeAdvancedCompletionScore, computeProfileCompletionScore } from "@/lib/clinicPortal";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";
import ClinicConversionPanel from "@/components/clinic-portal/ClinicConversionPanel";
import ClinicProgressGuidancePanel from "@/components/dashboard/ClinicProgressGuidancePanel";
import ParticipationStatusBanner from "@/components/dashboard/ParticipationStatusBanner";
import { SITE_URL } from "@/lib/constants";
import { BENCHMARKING_GLOBAL_STANDARDS } from "@/lib/benchmarkingCopy";

export default async function ClinicDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const userEmail = String(user.email ?? "").toLowerCase();

  const profileSelect =
    "id, linked_user_id, clinic_name, clinic_email, transparency_score, audited_case_count, contributed_case_count, benchmark_eligible_count, average_forensic_score, documentation_integrity_average, current_award_tier, award_progression_paused, volume_confidence_score, validated_case_count, provisional_high_score_count, validated_high_score_count, low_score_case_count, benchmark_eligible_validated_count, profile_visible, clinic_slug, participation_status, participation_approval_status";
  const { data: byUserProfile } = await admin
    .from("clinic_profiles")
    .select(profileSelect)
    .eq("linked_user_id", user.id)
    .limit(1)
    .maybeSingle();
  const { data: byEmailProfile } = !byUserProfile && userEmail
    ? await admin
        .from("clinic_profiles")
        .select(profileSelect)
        .eq("clinic_email", userEmail)
        .limit(1)
        .maybeSingle()
    : { data: null as typeof byUserProfile };

  let clinicProfile = byUserProfile ?? byEmailProfile;
  if (!clinicProfile && userEmail) {
    const { data: createdClinicProfile } = await admin
      .from("clinic_profiles")
      .insert({
        linked_user_id: user.id,
        clinic_name: `Clinic ${user.id.slice(0, 8)}`,
        clinic_email: userEmail,
      })
      .select(profileSelect)
      .maybeSingle();
    clinicProfile = createdClinicProfile;
  } else if (clinicProfile && !clinicProfile.linked_user_id) {
    await admin.from("clinic_profiles").update({ linked_user_id: user.id }).eq("id", clinicProfile.id);
  }

  const [{ data: cases }, { count: completedTotal }] = await Promise.all([
    admin
      .from("cases")
      .select("id, title, status, created_at")
      .eq("clinic_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", user.id)
      .eq("status", "complete"),
  ]);

  const [{ data: portalProfile }, { data: capabilityRows }, { count: workspaceCount }] = await Promise.all([
    admin
      .from("clinic_portal_profiles")
      .select("basic_profile, advanced_profile, onboarding_status, onboarding_completed_steps, portal_mode")
      .eq("clinic_profile_id", clinicProfile?.id ?? "")
      .maybeSingle(),
    admin
      .from("clinic_capability_catalog")
      .select("id", { count: "exact" })
      .eq("clinic_profile_id", clinicProfile?.id ?? "")
      .eq("is_active", true),
    admin
      .from("clinic_case_workspaces")
      .select("case_id", { count: "exact", head: true })
      .eq("clinic_profile_id", clinicProfile?.id ?? ""),
  ]);

  const basicProfile =
    portalProfile?.basic_profile && typeof portalProfile.basic_profile === "object"
      ? (portalProfile.basic_profile as Record<string, unknown>)
      : {};
  const advancedProfile =
    portalProfile?.advanced_profile && typeof portalProfile.advanced_profile === "object"
      ? (portalProfile.advanced_profile as Record<string, unknown>)
      : {};
  const basicCompletion = computeProfileCompletionScore(basicProfile);
  const advancedCompletion = computeAdvancedCompletionScore(advancedProfile);
  const onboardingSteps = Array.isArray(portalProfile?.onboarding_completed_steps)
    ? portalProfile?.onboarding_completed_steps.length
    : 0;
  const capabilityCount = capabilityRows?.length ?? 0;

  // Trend: last 30 days of completions (deduped per case by latest completed report timestamp).
  const days = 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const startIso = start.toISOString();

  const { data: completedCaseIds } = await admin
    .from("cases")
    .select("id")
    .eq("clinic_id", user.id)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1000);

  const idList = (completedCaseIds ?? []).map((r) => r.id).filter(Boolean);

  const dailyCounts = Array.from({ length: days }, () => 0);
  if (idList.length > 0) {
    const { data: reports } = await admin
      .from("reports")
      .select("case_id, created_at, status")
      .eq("status", "complete")
      .gte("created_at", startIso)
      .in("case_id", idList);

    const latestByCase = new Map<string, Date>();
    for (const r of reports ?? []) {
      const caseId = String(r.case_id ?? "");
      const d = r.created_at ? new Date(r.created_at) : null;
      if (!caseId || !d || Number.isNaN(d.getTime())) continue;
      const prev = latestByCase.get(caseId);
      if (!prev || d > prev) latestByCase.set(caseId, d);
    }

    for (const [, d] of latestByCase) {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      const idx = Math.floor((day.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      if (idx >= 0 && idx < days) dailyCounts[idx] += 1;
    }
  }

  const completedLast30 = dailyCounts.reduce((a, b) => a + b, 0);

  const currentTier = (clinicProfile?.current_award_tier ?? "VERIFIED") as "VERIFIED" | "SILVER" | "GOLD" | "PLATINUM";
  const nextTier = getNextTier(currentTier);
  const nextMilestone = getNextMilestoneFromProfile({
    current_award_tier: clinicProfile?.current_award_tier,
    validated_case_count: (clinicProfile as { validated_case_count?: number })?.validated_case_count ?? clinicProfile?.contributed_case_count,
    average_forensic_score: clinicProfile?.average_forensic_score,
    benchmark_eligible_validated_count: (clinicProfile as { benchmark_eligible_validated_count?: number })?.benchmark_eligible_validated_count ?? clinicProfile?.benchmark_eligible_count,
    transparency_score: clinicProfile?.transparency_score,
    documentation_integrity_average: clinicProfile?.documentation_integrity_average,
    award_progression_paused: (clinicProfile as { award_progression_paused?: boolean })?.award_progression_paused,
    volume_confidence_score: (clinicProfile as { volume_confidence_score?: number })?.volume_confidence_score,
  });

  const profileVisible = (clinicProfile as { profile_visible?: boolean })?.profile_visible;
  const clinicSlug = (clinicProfile as { clinic_slug?: string | null })?.clinic_slug;
  const publicProfileUrl = profileVisible && clinicSlug
    ? `${(process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? SITE_URL).replace(/\/+$/, "")}/clinics/${clinicSlug}`
    : null;
  const conversionActions = [
    onboardingSteps < 5 ? { label: "Complete your clinic identity", href: "/dashboard/clinic/onboarding" } : null,
    capabilityCount < 4 ? { label: "Add your surgical methods", href: "/dashboard/clinic/profile#clinical-stack" } : null,
    capabilityCount < 8 ? { label: "Upload devices and technology", href: "/dashboard/clinic/profile#clinical-stack" } : null,
    Number(workspaceCount ?? 0) === 0
      ? { label: "Submit your first case (Submitted Case)", href: "/dashboard/clinic/submit-case" }
      : { label: "Respond to Invited Contributions", href: "/dashboard/clinic/workspaces" },
    !profileVisible ? { label: "Prepare your public profile", href: "/dashboard/clinic/profile" } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;
  const readinessStates = [
    { label: "Basic Profile Complete", ready: basicCompletion >= 90 },
    { label: "Enhanced Trust Profile", ready: advancedCompletion >= 70 || Number(clinicProfile?.transparency_score ?? 0) >= 70 },
    { label: "Benchmark Ready", ready: Number(clinicProfile?.benchmark_eligible_count ?? 0) > 0 || Number(workspaceCount ?? 0) >= 3 },
    { label: profileVisible ? "Public Listing Active" : "Public Listing In Progress", ready: Boolean(profileVisible) },
    { label: "Training Ready", ready: advancedCompletion >= 80 && capabilityCount >= 6 },
  ];

  const progressSteps = buildClinicProgressSteps({
    onboardingSteps,
    basicCompletion,
    capabilityCount,
    submittedCasesCount: cases?.length ?? 0,
    completedCasesCount: completedTotal ?? 0,
    benchmarkEligibleCount: Number(clinicProfile?.benchmark_eligible_count ?? 0),
    profileVisible: Boolean(profileVisible),
  });

  return (
    <div>
      <ClinicSectionHeader
        title="Clinic Intelligence Overview"
        subtitle="Operational trust and clinical quality across your Invited Contributions (cases you were invited to) and Submitted Cases (cases your clinic created)."
        actions={[
          { href: "/dashboard/clinic/submit-case", label: "Submit Case", variant: "primary" },
          { href: "/dashboard/clinic/onboarding", label: "Onboarding" },
        ]}
      />
      <p className="mb-6 text-xs text-slate-500">{BENCHMARKING_GLOBAL_STANDARDS}</p>

      <div className="mb-6">
        <ParticipationStatusBanner
          status={((clinicProfile as { participation_approval_status?: string })?.participation_approval_status as "not_started" | "pending_review" | "approved" | "more_info_required") ?? "not_started"}
          role="clinic"
        />
      </div>

      <div className="mb-6">
        <ClinicProgressGuidancePanel
          steps={progressSteps}
          title="Your next steps"
          subtitle="Actions that improve profile completeness, benchmarking readiness, and public visibility."
        />
      </div>

      <div className="mb-6">
        <ClinicConversionPanel
          title="Grow trust and completion momentum"
          subtitle="Clinics that complete identity, methods, and case evidence are better positioned for patient confidence and verified visibility."
          nextActions={conversionActions.slice(0, 5)}
          readinessStates={readinessStates}
          teaserHref={publicProfileUrl ?? "/dashboard/clinic/profile"}
          teaserCtaLabel={publicProfileUrl ? "View public profile" : "Prepare public listing"}
        />
      </div>

      <div className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Onboarding</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{onboardingSteps}/5</div>
          <div className="mt-1 text-xs text-slate-500">
            Status: {String(portalProfile?.onboarding_status ?? "not_started").replaceAll("_", " ")}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Basic Profile Complete</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{basicCompletion}%</div>
          <div className="mt-1 text-xs text-slate-500">Identity and credibility baseline</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enhanced Trust Profile</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{advancedCompletion}%</div>
          <div className="mt-1 text-xs text-slate-500">QA depth, protocol maturity, and readiness</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clinical Stack</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{capabilityCount}</div>
          <div className="mt-1 text-xs text-slate-500">methods / tools / devices / protocols</div>
        </div>
      </div>

      <div className="grid gap-3 mb-6 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/dashboard/clinic/profile" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-cyan-300 transition-colors">
          <div className="text-sm font-semibold text-slate-900">Complete Profile</div>
          <p className="mt-1 text-xs text-slate-600">Basic + advanced clinic intelligence profile.</p>
        </Link>
        <Link href="/dashboard/clinic/workspaces" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-cyan-300 transition-colors">
          <div className="text-sm font-semibold text-slate-900">Invited Contributions</div>
          <p className="mt-1 text-xs text-slate-600">Cases you were invited to contribute to; respond and manage visibility.</p>
        </Link>
        <Link href="/dashboard/clinic/submit-case" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-cyan-300 transition-colors">
          <div className="text-sm font-semibold text-slate-900">Submit Case</div>
          <p className="mt-1 text-xs text-slate-600">Create Submitted Cases (clinic-owned audits) with controlled visibility.</p>
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Portal Mode</div>
          <p className="mt-1 text-xs text-slate-600">{String(portalProfile?.portal_mode ?? "hairaudit_public").replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs text-slate-500">Ready for training, benchmarking, and white-label layers.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold text-slate-500">Live audits completed</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-slate-900">{completedTotal ?? 0}</div>
              <div className="text-xs text-slate-500">total</div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Last 30 days: <span className="font-medium text-slate-700">{completedLast30}</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-1">
              <Sparkline
                values={dailyCounts}
                className="block"
                strokeClassName="text-amber-600"
                fillClassName="text-amber-200/40"
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Last 30 days</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 mb-6">
        <p className="text-sm text-amber-900">
          <strong>Invited Contributions</strong> are cases you were invited to contribute to (e.g. by patients). <strong>Submitted Cases</strong> are cases your clinic created and submitted. Convert both into trust: respond to invited cases and submit your own; set each to public or internal.
          Invited: <span className="font-semibold">{workspaceCount ?? 0}</span> · Submitted: <span className="font-semibold">{cases?.length ?? 0}</span>.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">Benchmarking</div>
            <div className="text-sm text-slate-700 mt-1">
              Clinic rankings are confidence-gated and only include benchmark-eligible cases.
            </div>
          </div>
          <Link
            href="/leaderboards/clinics"
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
          >
            View clinic leaderboard →
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <ClinicTransparencyProgressPanel
          profile={clinicProfile}
          nextMilestone={nextMilestone}
          nextTierLabel={nextTier}
        />
      </div>

      <div className="mb-6">
        <ClinicFeedbackPanel />
      </div>

      <div className="mb-6">
        <ClinicBadgeWidgetSection
          eligible={
            Boolean(
              (clinicProfile as { profile_visible?: boolean })?.profile_visible &&
                (clinicProfile as { clinic_slug?: string | null })?.clinic_slug &&
                clinicProfile?.current_award_tier
            )
          }
          profileUrl={`${(process.env.NEXT_PUBLIC_APP_URL ?? SITE_URL).replace(/\/+$/, "")}/clinics/${(clinicProfile as { clinic_slug?: string | null })?.clinic_slug ?? ""}`}
          slug={(clinicProfile as { clinic_slug?: string | null })?.clinic_slug ?? ""}
          clinicName={clinicProfile?.clinic_name ?? ""}
          currentAwardTier={clinicProfile?.current_award_tier ?? null}
          participationStatus={(clinicProfile as { participation_status?: string | null })?.participation_status ?? null}
          baseUrl={(process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? SITE_URL).replace(/\/+$/, "")}
        />
      </div>

      <div className="mb-8">
        <CreateCaseButton />
      </div>

      <h2 className="text-lg font-semibold text-slate-900 mt-8 mb-3">Submitted Cases</h2>
      <p className="text-sm text-slate-500 mb-3">Cases your clinic created and submitted (distinct from Invited Contributions, which appear under Invited Contributions).</p>
      {(!cases || cases.length === 0) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-700 font-semibold">
            Start with your first Submitted Case.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Clinics with attributable submitted cases build stronger quality-control data and future benchmarking leverage.
          </p>
          <CreateCaseButton />
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition-all"
              >
                <span className="font-medium text-slate-900">{c.title ?? "Patient audit"}</span>
                <span className="ml-2 text-slate-500 text-sm">— {c.status}</span>
                <div className="text-xs text-slate-400 mt-2">
                  Created: {new Date(c.created_at).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
