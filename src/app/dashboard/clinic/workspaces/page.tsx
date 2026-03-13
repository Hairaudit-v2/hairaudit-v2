import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import ClinicWorkspacePanel from "@/components/clinic-portal/ClinicWorkspacePanel";

export default async function ClinicWorkspacesPage() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clinic Audit Workspaces</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage clinic-submitted cases, respond to patient-submitted audits, and control visibility.
          </p>
        </div>
        <Link
          href="/dashboard/clinic"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to portal
        </Link>
      </div>

      <ClinicWorkspacePanel />
    </div>
  );
}
