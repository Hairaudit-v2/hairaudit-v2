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
        title="Invited Contributions"
        subtitle="Cases you were invited to contribute to (e.g. by patients). Respond, set visibility, and build trust."
        actions={[
          { href: "/dashboard/clinic/submit-case", label: "Submit New Case", variant: "primary" },
          { href: "/dashboard/clinic", label: "Overview" },
        ]}
      />

      <ClinicWorkspacePanel />
    </div>
  );
}
