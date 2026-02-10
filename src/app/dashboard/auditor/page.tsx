import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function AuditorDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: cases } = await admin
    .from("cases")
    .select("id, title, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Auditor Dashboard</h1>
          <p className="text-slate-600 text-sm mt-1">Full access to all submitted audit cases</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 mb-6">
        <p className="text-sm text-slate-800">
          View and review all patient, doctor, and clinic submissions. Access reports and audit details.
        </p>
      </div>

      <h2 className="text-lg font-semibold text-slate-900 mb-3">All audit cases</h2>
      {(!cases || cases.length === 0) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No cases submitted yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition-all"
              >
                <span className="font-medium text-slate-900">{c.title ?? "Untitled case"}</span>
                <span className="ml-2 text-slate-500 text-sm">— {c.status}</span>
                <div className="text-xs text-slate-400 mt-2">
                  Created: {new Date(c.created_at).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
