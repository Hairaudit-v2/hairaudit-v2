import { redirect } from "next/navigation";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";
import ClinicDoctorsManager from "@/components/clinic-portal/ClinicDoctorsManager";
import type { DoctorItem } from "@/components/clinic-portal/ClinicDoctorsManager";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { resolveClinicProfileForUser } from "@/lib/clinicPortal";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function DoctorsPage() {
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

  const [{ data: rows }, { data: portal }] = await Promise.all([
    admin
      .from("doctor_profiles")
      .select(
        "id, doctor_name, doctor_email, profile_image_url, professional_title, short_bio, specialties, years_experience, public_summary, associated_branches, is_active, archived_at, clinic_role, case_permissions, can_respond_audits, can_submit_cases, can_view_internal_cases, updated_at, created_at"
      )
      .eq("clinic_profile_id", clinicProfile.id)
      .order("is_active", { ascending: false })
      .order("doctor_name", { ascending: true }),
    admin
      .from("clinic_portal_profiles")
      .select("basic_profile")
      .eq("clinic_profile_id", clinicProfile.id)
      .maybeSingle(),
  ]);

  const basic = asRecord((portal as { basic_profile?: unknown } | null)?.basic_profile);
  const userRole =
    clinicProfile.linked_user_id === user.id
      ? "owner"
      : String(basic.clinic_user_role ?? "").toLowerCase() === "admin"
        ? "admin"
        : "member";
  const canManageDoctors = userRole === "owner" || userRole === "admin";

  return (
    <div>
      <ClinicSectionHeader
        title="Doctors"
        subtitle="Manage your doctor roster, internal permissions, and profile trust signals."
        actions={[
          { href: "/dashboard/clinic/clinic-cases", label: "Open Clinic Cases" },
          { href: "/dashboard/clinic/profile#clinical-stack", label: "Methods & Devices" },
        ]}
      />
      <ClinicDoctorsManager
        initialItems={((rows ?? []) as DoctorItem[])}
        canManageDoctors={canManageDoctors}
        userRole={userRole}
      />
    </div>
  );
}
