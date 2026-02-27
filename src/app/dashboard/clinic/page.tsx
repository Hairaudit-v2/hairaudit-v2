import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import CreateCaseButton from "../create-case-button";
import Sparkline from "@/components/ui/Sparkline";

export default async function ClinicDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();

  const [{ data: cases }, { count: completedTotal }] = await Promise.all([
    admin
      .from("cases")
      .select("id, title, status, created_at")
      .eq("clinic_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", user.id)
      .eq("status", "complete"),
  ]);

  // Trend: last 30 days of completions (deduped per case by latest completed report timestamp).
  const days = 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const startIso = start.toISOString();

  const { data: completedCaseIds } = await admin
    .from("cases")
    .select("id")
    .eq("clinic_id", user.id)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1000);

  const idList = (completedCaseIds ?? []).map((r) => r.id).filter(Boolean);

  const dailyCounts = Array.from({ length: days }, () => 0);
  if (idList.length > 0) {
    const { data: reports } = await admin
      .from("reports")
      .select("case_id, created_at, status")
      .eq("status", "complete")
      .gte("created_at", startIso)
      .in("case_id", idList);

    const latestByCase = new Map<string, Date>();
    for (const r of reports ?? []) {
      const caseId = String(r.case_id ?? "");
      const d = r.created_at ? new Date(r.created_at) : null;
      if (!caseId || !d || Number.isNaN(d.getTime())) continue;
      const prev = latestByCase.get(caseId);
      if (!prev || d > prev) latestByCase.set(caseId, d);
    }

    for (const [, d] of latestByCase) {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      const idx = Math.floor((day.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      if (idx >= 0 && idx < days) dailyCounts[idx] += 1;
    }
  }

  const completedLast30 = dailyCounts.reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clinic Dashboard</h1>
          <p className="text-slate-600 text-sm mt-1">Submit patient cases for feedback on your doctors&apos; work</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 mb-6">
        <p className="text-sm text-amber-900">
          Upload patient cases to get feedback on your doctors, nurses, and technicians. Compare outcomes and improve your clinic&apos;s standards.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold text-slate-500">Live audits completed</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-slate-900">{completedTotal ?? 0}</div>
              <div className="text-xs text-slate-500">total</div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Last 30 days: <span className="font-medium text-slate-700">{completedLast30}</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-1">
              <Sparkline
                values={dailyCounts}
                className="block"
                strokeClassName="text-amber-600"
                fillClassName="text-amber-200/40"
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Last 30 days</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">Benchmarking</div>
            <div className="text-sm text-slate-700 mt-1">
              Clinic rankings are confidence-gated and only include benchmark-eligible cases.
            </div>
          </div>
          <Link
            href="/leaderboards/clinics"
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
          >
            View clinic leaderboard →
          </Link>
        </div>
      </div>

      <div className="mb-8">
        <CreateCaseButton />
      </div>

      <h2 className="text-lg font-semibold text-slate-900 mt-8 mb-3">Our audit submissions</h2>
      {(!cases || cases.length === 0) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No cases yet. Create one to submit a patient case for audit.</p>
          <CreateCaseButton />
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition-all"
              >
                <span className="font-medium text-slate-900">{c.title ?? "Patient audit"}</span>
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
