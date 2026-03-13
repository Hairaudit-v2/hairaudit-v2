import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { resolveClinicProfileForUser } from "@/lib/clinicPortal";
import ClinicOnboardingFlow from "@/components/clinic-portal/ClinicOnboardingFlow";

export default async function ClinicOnboardingPage() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail: String(user.email ?? "").toLowerCase(),
  });
  if (!clinicProfile) redirect("/dashboard/clinic");

  const { data: portal } = await admin
    .from("clinic_portal_profiles")
    .select("onboarding_completed_steps, onboarding_current_step, portal_mode")
    .eq("clinic_profile_id", clinicProfile.id)
    .maybeSingle();

  const completedSteps =
    Array.isArray((portal as { onboarding_completed_steps?: unknown } | null)?.onboarding_completed_steps)
      ? ((portal as { onboarding_completed_steps: string[] }).onboarding_completed_steps ?? [])
      : [];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clinic Intelligence Onboarding</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure your clinic portal for premium operations, trust, and future readiness.
          </p>
        </div>
        <Link
          href="/dashboard/clinic"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to portal
        </Link>
      </div>

      <ClinicOnboardingFlow
        initialCompletedSteps={completedSteps}
        initialCurrentStep={String((portal as { onboarding_current_step?: string } | null)?.onboarding_current_step ?? "foundation")}
        initialPortalMode={String((portal as { portal_mode?: string } | null)?.portal_mode ?? "hairaudit_public")}
      />
    </div>
  );
}
