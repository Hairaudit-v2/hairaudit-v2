import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import { buildTraineeDuplicateHints } from "@/lib/academy/traineeDuplicates";
import AdminTraineesRosterClient from "@/components/academy/admin/AdminTraineesRosterClient";

export const dynamic = "force-dynamic";

export default async function AcademyAdminTraineesPage() {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (access.role !== "academy_admin") redirect("/academy/dashboard");

  const supabase = await createSupabaseAuthServerClient();
  const { data: trainees, error } = await supabase
    .from("training_doctors")
    .select("id, full_name, email, auth_user_id, status, current_stage, created_at")
    .order("full_name", { ascending: true });

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Trainee roster & cleanup</h1>
        <p className="text-sm text-red-700">Could not load trainees: {error.message}</p>
      </div>
    );
  }

  const rows = trainees ?? [];
  const duplicateHints = buildTraineeDuplicateHints(rows);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/academy/admin" className="text-sm font-medium text-amber-800 hover:underline">
          ← Admin overview
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Trainee roster & cleanup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Filter by roster status, spot duplicate profiles, and open edit to withdraw, archive, restore, or (when safe) hard-delete a
          mistaken row.
        </p>
      </div>
      <AdminTraineesRosterClient trainees={rows} duplicateHints={duplicateHints} />
    </div>
  );
}
