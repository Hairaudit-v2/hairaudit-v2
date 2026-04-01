import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";

export const dynamic = "force-dynamic";

export default async function AcademyTraineesListPage() {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!access.isStaff) redirect("/academy/dashboard");

  const supabase = await createSupabaseAuthServerClient();
  const { data: doctors, error } = await supabase
    .from("training_doctors")
    .select("id, full_name, email, current_stage, status, created_at")
    .order("full_name", { ascending: true });

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        <p className="text-red-700 text-sm">Could not load trainees: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Trainees</h1>
          <p className="mt-1 text-sm text-slate-600">FUE doctor profiles under IIOHR Academy</p>
        </div>
        <Link
          href="/academy/trainees/new"
          className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          New trainee
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 hidden sm:table-cell">Email</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(doctors ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No trainees yet. Create the first profile.
                </td>
              </tr>
            ) : (
              (doctors ?? []).map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <Link href={`/academy/trainees/${d.id}`} className="font-medium text-amber-800 hover:underline">
                      {d.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{d.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{d.current_stage}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{d.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
