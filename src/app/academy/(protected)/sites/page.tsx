import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import { listAcademySites } from "@/lib/academy/academySites";
import AcademyNewSiteForm from "./AcademyNewSiteForm";

export const dynamic = "force-dynamic";

export default async function AcademySitesListPage() {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (access.role !== "academy_admin") redirect("/academy/dashboard");

  const supabase = await createSupabaseAuthServerClient();
  const sites = await listAcademySites(supabase);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/academy/dashboard" className="text-sm font-medium text-amber-700 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Academy sites</h1>
          <p className="mt-1 text-sm text-slate-600">
            Training locations / programs inbox routing. Roster emails use each site&apos;s{" "}
            <strong>ops notification email</strong> when linked from a program or trainee; otherwise the global env
            fallback applies.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 hidden sm:table-cell">Slug</th>
              <th className="px-4 py-3">Ops inbox</th>
              <th className="px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sites.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No sites yet. Add one below (requires DB migration for academy_sites).
                </td>
              </tr>
            ) : (
              sites.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <Link href={`/academy/sites/${s.id}`} className="font-medium text-amber-800 hover:underline">
                      {s.display_name?.trim() || s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs hidden sm:table-cell">{s.slug}</td>
                  <td className="px-4 py-3 text-slate-700 break-all max-w-[200px]">
                    {s.ops_notification_email?.trim() || (
                      <span className="text-slate-400 italic">fallback env</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{s.is_active ? "Yes" : "No"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">New academy site</h2>
        <AcademyNewSiteForm />
      </section>
    </div>
  );
}
