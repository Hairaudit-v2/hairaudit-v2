import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import ClinicWorkspacePanel from "@/components/clinic-portal/ClinicWorkspacePanel";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";

export default async function ClinicWorkspacesPage() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div>
      <ClinicSectionHeader
        title="Clinic Audit Workspaces"
        subtitle="Manage clinic-submitted cases, respond to patient-submitted audits, and control visibility."
        actions={[
          { href: "/dashboard/clinic/submit-case", label: "Submit New Case", variant: "primary" },
          { href: "/dashboard/clinic", label: "Overview" },
        ]}
      />

      <ClinicWorkspacePanel />
    </div>
  );
}
