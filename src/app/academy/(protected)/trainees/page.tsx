import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess, isAcademyAdminRole } from "@/lib/academy/auth";
import { parseTraineeListStatusFilter, statusesForListFilter, traineeStatusLabel } from "@/lib/academy/traineeStatus";
import TraineeListStatusFilter from "@/components/academy/TraineeListStatusFilter";

export const dynamic = "force-dynamic";

export default async function AcademyTraineesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!access.isStaff) redirect("/academy/dashboard");

  const sp = await searchParams;
  const filter = parseTraineeListStatusFilter(sp.status);
  const statuses = statusesForListFilter(filter);

  const supabase = await createSupabaseAuthServerClient();
  let q = supabase
    .from("training_doctors")
    .select("id, full_name, email, current_stage, status, created_at")
    .order("full_name", { ascending: true });
  if (statuses !== "all") {
    q = q.in("status", statuses);
  }
  const { data: doctors, error } = await q;

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
        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={<span className="text-sm text-slate-500">Filter…</span>}>
            <TraineeListStatusFilter current={filter} />
          </Suspense>
          <Link
            href="/academy/trainees/new"
            className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            New trainee
          </Link>
        </div>
      </div>

      {filter === "operational" ? (
        <p className="text-xs text-slate-600">
          Showing active, paused, and graduated trainees. Use the filter to include withdrawn, archived, or everyone.
          {isAcademyAdminRole(access.role) ? (
            <>
              {" "}
              <Link href="/academy/admin/trainees" className="font-medium text-amber-800 hover:underline">
                Admin roster & duplicate check
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

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
                  No trainees in this view. Try another filter or create a profile.
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
                  <td className="px-4 py-3 text-slate-600">{traineeStatusLabel(d.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
