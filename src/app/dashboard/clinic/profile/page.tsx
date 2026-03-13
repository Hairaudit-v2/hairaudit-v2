import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import {
  computeAdvancedCompletionScore,
  computeProfileCompletionScore,
  resolveClinicProfileForUser,
} from "@/lib/clinicPortal";
import ClinicProfileBuilder from "@/components/clinic-portal/ClinicProfileBuilder";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";
import ClinicConversionPanel from "@/components/clinic-portal/ClinicConversionPanel";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function ClinicProfilePage() {
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

  const [{ data: portal }, { data: capabilities }] = await Promise.all([
    admin
      .from("clinic_portal_profiles")
      .select("basic_profile, advanced_profile")
      .eq("clinic_profile_id", clinicProfile.id)
      .maybeSingle(),
    admin
      .from("clinic_capability_catalog")
      .select("id, capability_type, capability_name, capability_details")
      .eq("clinic_profile_id", clinicProfile.id)
      .order("capability_type", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  const basicProfile = asRecord((portal as { basic_profile?: unknown } | null)?.basic_profile);
  const advancedProfile = asRecord((portal as { advanced_profile?: unknown } | null)?.advanced_profile);
  const basicCompletion = computeProfileCompletionScore(basicProfile);
  const advancedCompletion = computeAdvancedCompletionScore(advancedProfile);
  const capabilityCount = capabilities?.length ?? 0;

  return (
    <div>
      <ClinicSectionHeader
        title="Clinic Profile Builder"
        subtitle="Build a premium clinic profile that converts quality signals into trust, discoverability, and future benchmark strength."
        actions={[
          { href: "/dashboard/clinic/workspaces", label: "Go to Workspaces", variant: "primary" },
          { href: "/dashboard/clinic", label: "Overview" },
        ]}
      />

      <div className="mb-6">
        <ClinicConversionPanel
          title="Profile completion conversion layer"
          subtitle="Completing identity, methods, and protocol depth improves patient confidence and sets up defensible benchmarking inputs."
          nextActions={[
            basicCompletion < 90
              ? { label: "Complete your clinic identity", href: "/dashboard/clinic/profile" }
              : { label: "Prepare your public profile", href: "/dashboard/clinic/profile" },
            capabilityCount < 6
              ? { label: "Add your surgical methods", href: "/dashboard/clinic/profile#clinical-stack" }
              : { label: "Upload devices and technology", href: "/dashboard/clinic/profile#clinical-stack" },
            { label: "Respond to patient-submitted cases", href: "/dashboard/clinic/workspaces" },
          ]}
          readinessStates={[
            { label: "Basic Profile Complete", ready: basicCompletion >= 90 },
            { label: "Enhanced Trust Profile", ready: advancedCompletion >= 70 },
            { label: "Benchmark Ready", ready: advancedCompletion >= 80 && capabilityCount >= 6 },
            { label: "Public Listing In Progress", ready: basicCompletion >= 80 },
            { label: "Training Ready", ready: advancedCompletion >= 80 },
          ]}
        />
      </div>

      <ClinicProfileBuilder
        initialBasicProfile={basicProfile}
        initialAdvancedProfile={advancedProfile}
        initialBasicCompletion={basicCompletion}
        initialAdvancedCompletion={advancedCompletion}
        initialCapabilities={
          (capabilities as Array<{
            id: string;
            capability_type: string;
            capability_name: string;
            capability_details: Record<string, unknown>;
          }> | null) ?? []
        }
      />
    </div>
  );
}
