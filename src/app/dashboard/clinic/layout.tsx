import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import {
  computeAdvancedCompletionScore,
  computeProfileCompletionScore,
  resolveClinicProfileForUser,
} from "@/lib/clinicPortal";
import ClinicPortalShell from "@/components/clinic-portal/shell/ClinicPortalShell";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function ClinicPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail: String(user.email ?? "").toLowerCase(),
  });

  if (!clinicProfile) redirect("/dashboard");

  const [{ data: profile }, { data: portalProfile }, { count: capabilityCount }, { count: workspaceCount }, { count: pendingResponses }] =
    await Promise.all([
      admin
        .from("clinic_profiles")
        .select("clinic_name, current_award_tier, participation_status, profile_visible, transparency_score, benchmark_eligible_count")
        .eq("id", clinicProfile.id)
        .maybeSingle(),
      admin
        .from("clinic_portal_profiles")
        .select(
          "onboarding_completed_steps, onboarding_status, basic_profile, advanced_profile, internal_qa_enabled, clinic_benchmarking_enabled, training_readiness_score"
        )
        .eq("clinic_profile_id", clinicProfile.id)
        .maybeSingle(),
      admin
        .from("clinic_capability_catalog")
        .select("id", { count: "exact", head: true })
        .eq("clinic_profile_id", clinicProfile.id)
        .eq("is_active", true),
      admin
        .from("clinic_case_workspaces")
        .select("case_id", { count: "exact", head: true })
        .eq("clinic_profile_id", clinicProfile.id),
      admin
        .from("clinic_case_workspaces")
        .select("case_id", { count: "exact", head: true })
        .eq("clinic_profile_id", clinicProfile.id)
        .eq("clinic_response_status", "pending_response"),
    ]);

  const basicProfile = asRecord((portalProfile as { basic_profile?: unknown } | null)?.basic_profile);
  const advancedProfile = asRecord((portalProfile as { advanced_profile?: unknown } | null)?.advanced_profile);
  const basicCompletion = computeProfileCompletionScore(basicProfile);
  const advancedCompletion = computeAdvancedCompletionScore(advancedProfile);
  const completionPercent = Math.round((basicCompletion + advancedCompletion) / 2);
  const capabilityTotal = Number(capabilityCount ?? 0);
  const workspaceTotal = Number(workspaceCount ?? 0);
  const pendingResponsesTotal = Number(pendingResponses ?? 0);
  const onboardingSteps = Array.isArray((portalProfile as { onboarding_completed_steps?: unknown } | null)?.onboarding_completed_steps)
    ? ((portalProfile as { onboarding_completed_steps: unknown[] }).onboarding_completed_steps ?? []).length
    : 0;

  const transparency = Number((profile as { transparency_score?: number | null } | null)?.transparency_score ?? 0);
  const tier = String((profile as { current_award_tier?: string | null } | null)?.current_award_tier ?? "VERIFIED");
  const trustStatus =
    tier === "PLATINUM" || tier === "GOLD"
      ? "High Trust Recognition"
      : transparency >= 70
        ? "Verified Transparency Progress"
        : "Trust Profile In Development";

  const internalQaReady =
    Boolean((portalProfile as { internal_qa_enabled?: boolean } | null)?.internal_qa_enabled) ||
    advancedCompletion >= 70;
  const publicProfileLive = Boolean((profile as { profile_visible?: boolean | null } | null)?.profile_visible);
  const benchmarkReady =
    Boolean((portalProfile as { clinic_benchmarking_enabled?: boolean } | null)?.clinic_benchmarking_enabled) &&
    (Number((profile as { benchmark_eligible_count?: number | null } | null)?.benchmark_eligible_count ?? 0) > 0 ||
      workspaceTotal >= 3);
  const trainingReady =
    Number((portalProfile as { training_readiness_score?: number | null } | null)?.training_readiness_score ?? 0) >= 70 ||
    (advancedCompletion >= 80 && capabilityTotal >= 6);

  const nextAction =
    onboardingSteps < 5
      ? {
          title: "Complete your clinic identity",
          description: "Finish onboarding foundations to unlock trust-building workflows across the portal.",
          href: "/dashboard/clinic/onboarding",
          ctaLabel: "Continue onboarding",
        }
      : capabilityTotal < 4
        ? {
            title: "Add your surgical methods",
            description: "Document your clinical approach to improve profile credibility and attribution quality.",
            href: "/dashboard/clinic/profile#clinical-stack",
            ctaLabel: "Add methods",
          }
        : capabilityTotal < 8
          ? {
              title: "Upload devices and technology",
              description: "Expand your technology stack for stronger operational trust and benchmark preparation.",
              href: "/dashboard/clinic/profile#clinical-stack",
              ctaLabel: "Add devices",
            }
          : pendingResponsesTotal > 0
          ? {
              title: "Respond to Invited Contributions",
              description: "Cases you were invited to need your response to protect trust and care transparency.",
              href: "/dashboard/clinic/workspaces",
              ctaLabel: "Open Invited Contributions",
            }
            : workspaceTotal === 0
              ? {
                  title: "Submit your first case (Submitted Case)",
                  description: "Create a Submitted Case to establish your quality-control baseline.",
                  href: "/dashboard/clinic/submit-case",
                  ctaLabel: "Submit case",
                }
              : !publicProfileLive
                ? {
                    title: "Prepare your public profile",
                    description: "Convert your operational data into verified public-facing credibility assets.",
                    href: "/dashboard/clinic/profile",
                    ctaLabel: "Prepare listing",
                  }
                : {
                    title: "Advance benchmarking readiness",
                    description: "Scale benchmark-eligible evidence and sustain documentation integrity.",
                    href: "/leaderboards/clinics",
                    ctaLabel: "View benchmarks",
                  };

  const clinicName = String((profile as { clinic_name?: string | null } | null)?.clinic_name ?? "Clinic");
  const avatarLabel = clinicName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navItems = [
    { label: "Overview", href: "/dashboard/clinic" },
    { label: "Onboarding", href: "/dashboard/clinic/onboarding", matchPrefix: "/dashboard/clinic/onboarding" },
    { label: "Clinic Profile", href: "/dashboard/clinic/profile", matchPrefix: "/dashboard/clinic/profile" },
    { label: "Public Preview", href: "/dashboard/clinic/public-preview", matchPrefix: "/dashboard/clinic/public-preview" },
    { label: "Invited Contributions", href: "/dashboard/clinic/workspaces", matchPrefix: "/dashboard/clinic/workspaces" },
    { label: "Submit Case", href: "/dashboard/clinic/submit-case", matchPrefix: "/dashboard/clinic/submit-case" },
    { label: "Clinic Cases", href: "/dashboard/clinic/clinic-cases", matchPrefix: "/dashboard/clinic/clinic-cases" },
    { label: "Doctors", href: "/dashboard/clinic/doctors", matchPrefix: "/dashboard/clinic/doctors" },
    { label: "Methods & Devices", href: "/dashboard/clinic/profile#clinical-stack", matchPrefix: "/dashboard/clinic/profile" },
    { label: "Benchmarking", href: "/dashboard/clinic/benchmarking", placeholder: true },
    { label: "Training", href: "/dashboard/clinic/training", placeholder: true },
    { label: "Settings", href: "/dashboard/clinic/settings", placeholder: true },
  ];

  return (
    <ClinicPortalShell
      clinicName={clinicName}
      trustStatus={trustStatus}
      avatarLabel={avatarLabel}
      pendingResponses={pendingResponsesTotal}
      completionPercent={completionPercent}
      onboardingSteps={onboardingSteps}
      statusChips={[
        { label: "Basic Profile Complete", ready: basicCompletion >= 90 },
        { label: "Enhanced Trust Profile", ready: advancedCompletion >= 70 || transparency >= 70 },
        { label: "Benchmark Ready", ready: benchmarkReady },
        { label: publicProfileLive ? "Public Listing Active" : "Public Listing In Progress", ready: publicProfileLive },
        { label: "Training Ready", ready: trainingReady },
        { label: "Internal QA Ready", ready: internalQaReady },
      ]}
      nextAction={nextAction}
      navItems={navItems}
    >
      {children}
    </ClinicPortalShell>
  );
}
