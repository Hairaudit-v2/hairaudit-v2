import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import {
  computeAdvancedCompletionScore,
  computeProfileCompletionScore,
  resolveClinicProfileForUser,
} from "@/lib/clinicPortal";
import ClinicProfileBuilder from "@/components/clinic-portal/ClinicProfileBuilder";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";

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

  return (
    <div>
      <ClinicSectionHeader
        title="Clinic Profile Builder"
        subtitle="Maintain basic and advanced profile intelligence for trust, QA, and benchmarking."
        actions={[
          { href: "/dashboard/clinic/workspaces", label: "Go to Workspaces", variant: "primary" },
          { href: "/dashboard/clinic", label: "Overview" },
        ]}
      />

      <ClinicProfileBuilder
        initialBasicProfile={basicProfile}
        initialAdvancedProfile={advancedProfile}
        initialBasicCompletion={computeProfileCompletionScore(basicProfile)}
        initialAdvancedCompletion={computeAdvancedCompletionScore(advancedProfile)}
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
