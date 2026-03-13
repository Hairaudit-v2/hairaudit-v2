import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { resolveClinicProfileForUser } from "@/lib/clinicPortal";
import ClinicOnboardingFlow from "@/components/clinic-portal/ClinicOnboardingFlow";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";

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
    <div>
      <ClinicSectionHeader
        title="Clinic Intelligence Onboarding"
        subtitle="Configure your portal architecture for trust, operations, and future growth."
        actions={[
          { href: "/dashboard/clinic/profile", label: "Open Profile Builder", variant: "primary" },
          { href: "/dashboard/clinic", label: "Overview" },
        ]}
      />

      <ClinicOnboardingFlow
        initialCompletedSteps={completedSteps}
        initialCurrentStep={String((portal as { onboarding_current_step?: string } | null)?.onboarding_current_step ?? "foundation")}
        initialPortalMode={String((portal as { portal_mode?: string } | null)?.portal_mode ?? "hairaudit_public")}
      />
    </div>
  );
}
