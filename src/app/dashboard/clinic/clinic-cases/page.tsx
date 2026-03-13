import { redirect } from "next/navigation";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";
import ClinicCasesManager from "@/components/clinic-portal/ClinicCasesManager";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { resolveClinicProfileForUser } from "@/lib/clinicPortal";

export default async function ClinicCasesPage() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await resolveClinicProfileForUser({
    userId: user.id,
    userEmail: String(user.email ?? "").toLowerCase(),
  });

  return (
    <div>
      <ClinicSectionHeader
        title="Clinic Cases"
        subtitle="Premium operating layer for patient-submitted and clinic-submitted case management."
        actions={[
          { href: "/dashboard/clinic/submit-case", label: "Submit New Case", variant: "primary" },
          { href: "/dashboard/clinic/workspaces", label: "Open Workspaces" },
        ]}
      />
      <ClinicCasesManager />
    </div>
  );
}
