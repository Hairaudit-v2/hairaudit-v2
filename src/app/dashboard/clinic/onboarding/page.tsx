import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { resolveClinicProfileForUser } from "@/lib/clinicPortal";
import ClinicOnboardingFlow from "@/components/clinic-portal/ClinicOnboardingFlow";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";
import ClinicConversionPanel from "@/components/clinic-portal/ClinicConversionPanel";

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
  const hasFoundation = completedSteps.includes("foundation");
  const hasClinicalStack = completedSteps.includes("clinical_stack");
  const hasWorkspaces = completedSteps.includes("audit_workspaces");
  const hasVisibility = completedSteps.includes("visibility_controls");
  const hasActivation = completedSteps.includes("activation");

  return (
    <div>
      <ClinicSectionHeader
        title="Clinic Intelligence Onboarding"
        subtitle="Configure your trust architecture for premium credibility, operational discipline, and future benchmarking growth."
        actions={[
          { href: "/dashboard/clinic/profile", label: "Open Profile Builder", variant: "primary" },
          { href: "/dashboard/clinic", label: "Overview" },
        ]}
      />

      <div className="mb-6">
        <ClinicConversionPanel
          title="Onboarding conversion guidance"
          subtitle="Each completed onboarding step unlocks stronger trust signals and cleaner clinic operating workflows."
          nextActions={[
            !hasFoundation
              ? { label: "Complete your clinic identity", href: "/dashboard/clinic/onboarding" }
              : !hasClinicalStack
                ? { label: "Add your surgical methods", href: "/dashboard/clinic/profile#clinical-stack" }
                : !hasWorkspaces
                  ? { label: "Respond to Invited Contributions", href: "/dashboard/clinic/workspaces" }
                  : !hasVisibility
                    ? { label: "Prepare your public profile", href: "/dashboard/clinic/profile" }
                    : { label: "Submit your first case (Submitted Case)", href: "/dashboard/clinic/submit-case" },
            { label: "Upload devices and technology", href: "/dashboard/clinic/profile#clinical-stack" },
          ]}
          readinessStates={[
            { label: "Basic Profile Complete", ready: hasFoundation },
            { label: "Enhanced Trust Profile", ready: hasClinicalStack },
            { label: "Benchmark Ready", ready: hasActivation },
            { label: "Public Listing In Progress", ready: hasVisibility },
            { label: "Training Ready", ready: hasActivation },
          ]}
        />
      </div>

      <ClinicOnboardingFlow
        initialCompletedSteps={completedSteps}
        initialCurrentStep={String((portal as { onboarding_current_step?: string } | null)?.onboarding_current_step ?? "foundation")}
        initialPortalMode={String((portal as { portal_mode?: string } | null)?.portal_mode ?? "hairaudit_public")}
      />
    </div>
  );
}
