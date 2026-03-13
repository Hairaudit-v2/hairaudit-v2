import { redirect } from "next/navigation";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";
import ClinicPublicPreview from "@/components/clinic-portal/ClinicPublicPreview";
import {
  computeAdvancedCompletionScore,
  computeProfileCompletionScore,
  resolveClinicProfileForUser,
} from "@/lib/clinicPortal";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

type CapabilityRow = {
  capability_type: string;
  capability_name: string;
};

type DoctorRow = {
  id: string;
  doctor_name: string;
  professional_title?: string | null;
  years_experience?: number | null;
  specialties?: string[] | null;
  profile_image_url?: string | null;
  public_summary?: string | null;
  short_bio?: string | null;
  is_active?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export default async function ClinicPublicPreviewPage() {
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

  const [{ data: profile }, { data: portal }, { data: capabilities }, doctorsResult] = await Promise.all([
    admin
      .from("clinic_profiles")
      .select(
        "id, clinic_name, city, country, profile_visible, transparency_score, current_award_tier, participation_status, benchmark_eligible_count, documentation_integrity_average, clinic_slug"
      )
      .eq("id", clinicProfile.id)
      .maybeSingle(),
    admin
      .from("clinic_portal_profiles")
      .select("basic_profile, advanced_profile, onboarding_completed_steps, training_readiness_score")
      .eq("clinic_profile_id", clinicProfile.id)
      .maybeSingle(),
    admin
      .from("clinic_capability_catalog")
      .select("capability_type, capability_name")
      .eq("clinic_profile_id", clinicProfile.id)
      .eq("is_active", true)
      .order("capability_type", { ascending: true })
      .order("sort_order", { ascending: true }),
    admin
      .from("doctor_profiles")
      .select(
        "id, doctor_name, professional_title, years_experience, specialties, profile_image_url, public_summary, short_bio, is_active"
      )
      .eq("clinic_profile_id", clinicProfile.id)
      .eq("is_active", true)
      .order("doctor_name", { ascending: true }),
  ]);

  let doctors = (doctorsResult.data as DoctorRow[] | null) ?? [];
  if (doctorsResult.error) {
    const doctorsFallback = await admin
      .from("doctor_profiles")
      .select("id, doctor_name")
      .eq("clinic_profile_id", clinicProfile.id)
      .order("doctor_name", { ascending: true });
    doctors = ((doctorsFallback.data as Array<{ id: string; doctor_name: string }> | null) ?? []).map((d) => ({
      ...d,
      professional_title: null,
      years_experience: null,
      specialties: [],
      profile_image_url: null,
      public_summary: null,
      short_bio: null,
      is_active: true,
    }));
  }

  const profileRow = (profile as Record<string, unknown> | null) ?? {};
  const basicProfile = asRecord((portal as { basic_profile?: unknown } | null)?.basic_profile);
  const advancedProfile = asRecord((portal as { advanced_profile?: unknown } | null)?.advanced_profile);
  const onboardingCount = Array.isArray((portal as { onboarding_completed_steps?: unknown } | null)?.onboarding_completed_steps)
    ? ((portal as { onboarding_completed_steps: unknown[] }).onboarding_completed_steps ?? []).length
    : 0;

  const basicCompletion = computeProfileCompletionScore(basicProfile);
  const advancedCompletion = computeAdvancedCompletionScore(advancedProfile);
  const trainingReadiness =
    Number((portal as { training_readiness_score?: number | null } | null)?.training_readiness_score ?? 0) >= 70 ||
    advancedCompletion >= 80;

  const location = [
    String(basicProfile.primary_city ?? "").trim() || String(profileRow.city ?? "").trim(),
    String(basicProfile.primary_country ?? "").trim() || String(profileRow.country ?? "").trim(),
  ]
    .filter(Boolean)
    .join(", ");

  const capabilityRows = (capabilities as CapabilityRow[] | null) ?? [];
  const methods = capabilityRows.filter((row) => row.capability_type === "method").map((row) => row.capability_name);
  const toolsDevices = capabilityRows
    .filter((row) => row.capability_type === "tool" || row.capability_type === "device" || row.capability_type === "machine")
    .map((row) => row.capability_name);
  const extras = capabilityRows
    .filter((row) => row.capability_type === "optional_extra" || row.capability_type === "protocol")
    .map((row) => row.capability_name);

  const proceduresOffered = unique(methods).slice(0, 8);
  const doctorCards = doctors.map((row) => ({
    id: row.id,
    name: row.doctor_name,
    title: String(row.professional_title ?? "Doctor"),
    yearsExperience: row.years_experience ?? null,
    specialties: asArray(row.specialties),
    profileImage: row.profile_image_url ?? null,
    summary: row.public_summary ?? row.short_bio ?? null,
  }));

  const transparency = Number(profileRow.transparency_score ?? 0);
  const tier = String(profileRow.current_award_tier ?? "VERIFIED");
  const benchmarkEligible = Number(profileRow.benchmark_eligible_count ?? 0);
  const docsIntegrity = Number(profileRow.documentation_integrity_average ?? 0);
  const publicProfileLive = Boolean(profileRow.profile_visible);
  const readinessStates = [
    { label: "Basic Profile Complete", ready: basicCompletion >= 90 },
    { label: "Enhanced Trust Profile", ready: advancedCompletion >= 70 || transparency >= 70 },
    { label: "Benchmark Ready", ready: benchmarkEligible > 0 },
    { label: "Public Listing In Progress", ready: publicProfileLive || basicCompletion >= 80 },
    { label: "Training Ready", ready: trainingReadiness },
  ];

  const trustMetrics: Array<{ label: string; value: string; tone?: "default" | "success" | "warning" }> = [
    { label: "Trust tier", value: tier, tone: tier === "GOLD" || tier === "PLATINUM" ? "success" : "default" as const },
    { label: "Transparency", value: `${transparency}%`, tone: transparency >= 70 ? "success" as const : "warning" as const },
    { label: "Profile completion", value: `${Math.round((basicCompletion + advancedCompletion) / 2)}%` },
    { label: "Benchmark-eligible cases", value: String(benchmarkEligible), tone: benchmarkEligible > 0 ? "success" as const : "warning" as const },
    { label: "Documentation integrity", value: docsIntegrity > 0 ? `${docsIntegrity.toFixed(1)}` : "Pending", tone: docsIntegrity >= 70 ? "success" as const : "warning" as const },
    { label: "Onboarding progress", value: `${onboardingCount}/5`, tone: onboardingCount >= 5 ? "success" as const : "warning" as const },
  ];

  const missingItems = [
    !String(basicProfile.tagline ?? "").trim()
      ? { label: "Add clinic positioning tagline", href: "/dashboard/clinic/profile" }
      : null,
    !location ? { label: "Add primary location", href: "/dashboard/clinic/profile" } : null,
    methods.length === 0
      ? { label: "Add surgical methods", href: "/dashboard/clinic/profile#clinical-stack" }
      : null,
    toolsDevices.length < 2
      ? { label: "Add devices and technology", href: "/dashboard/clinic/profile#clinical-stack" }
      : null,
    extras.length === 0
      ? { label: "Add optional extras or protocols", href: "/dashboard/clinic/profile#clinical-stack" }
      : null,
    doctorCards.length === 0
      ? { label: "Add doctor cards", href: "/dashboard/clinic/doctors" }
      : null,
    doctorCards.some((doctor) => !doctor.summary)
      ? { label: "Add doctor public summaries", href: "/dashboard/clinic/doctors" }
      : null,
    !publicProfileLive
      ? { label: "Prepare public listing settings", href: "/dashboard/clinic/profile" }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <div>
      <ClinicSectionHeader
        title="Public Clinic Preview"
        subtitle="A trust-building preview of how your clinic can appear publicly once publishing is enabled."
        badge="Preview"
        actions={[
          { href: "/dashboard/clinic/profile", label: "Improve Profile", variant: "primary" },
          { href: "/dashboard/clinic/doctors", label: "Update Doctors" },
        ]}
      />

      <ClinicPublicPreview
        clinicName={String(profileRow.clinic_name ?? "Clinic")}
        tagline={String(basicProfile.tagline ?? "Evidence-led hair restoration care profile in development.")}
        location={location || "Location not yet configured"}
        proceduresOffered={proceduresOffered}
        capabilityGroups={[
          { label: "Methods and procedures", items: unique(methods) },
          { label: "Methods/devices highlights", items: unique(toolsDevices) },
          { label: "Optional extras and protocols", items: unique(extras) },
        ]}
        doctors={doctorCards}
        readinessStates={readinessStates}
        trustMetrics={trustMetrics}
        missingItems={missingItems}
        publicProfileLive={publicProfileLive}
      />
    </div>
  );
}
