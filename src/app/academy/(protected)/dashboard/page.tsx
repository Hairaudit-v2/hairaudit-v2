import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import { fetchTrainingDoctorForUser, fetchTrainingCasesForDoctor } from "@/lib/academy/queries";
import {
  computeTraineeProgressSnapshot,
  domainAveragesFromAssessments,
  trendValuesFromCases,
} from "@/lib/academy/progression";
import type { TrainingCaseMetricsRow, TrainingCaseAssessmentRow } from "@/lib/academy/types";
import Sparkline from "@/components/ui/Sparkline";

export const dynamic = "force-dynamic";

function startOfMonthIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function badgeClass(badge: string) {
  switch (badge) {
    case "on_track":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
    case "needs_support":
      return "bg-rose-100 text-rose-900 ring-rose-200";
    case "ready_for_progression":
      return "bg-sky-100 text-sky-900 ring-sky-200";
    case "review_required":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-800 ring-slate-200";
  }
}

export default async function AcademyDashboardPage() {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");

  const supabase = await createSupabaseAuthServerClient();

  if (access.isStaff) {
    const [{ data: doctors }, { count: monthCases }, { data: recentReviews }] = await Promise.all([
      supabase.from("training_doctors").select("id, current_stage, status, full_name").order("created_at", { ascending: false }),
      supabase
        .from("training_cases")
        .select("id", { count: "exact", head: true })
        .gte("surgery_date", startOfMonthIsoDate()),
      supabase
        .from("training_case_assessments")
        .select("id, created_at, overall_score, ready_to_progress, training_case_id")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const list = doctors ?? [];
    const byStage = list.reduce<Record<string, number>>((acc, d) => {
      const s = d.current_stage || "unknown";
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});

    const { count: inReview } = await supabase
      .from("training_cases")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_review");

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Academy dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">IIOHR surgical training overview</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Trainees</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{list.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Cases this month</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{monthCases ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Cases in review</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{inReview ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Stages (headcount)</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {Object.keys(byStage).length === 0 ? (
                <span className="text-slate-500">No trainees yet</span>
              ) : (
                Object.entries(byStage).map(([k, v]) => (
                  <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-800">
                    {k}: {v}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Recent reviews</h2>
            <Link href="/academy/trainees" className="text-sm font-medium text-amber-700 hover:text-amber-800">
              Trainees
            </Link>
          </div>
          {!recentReviews?.length ? (
            <p className="text-sm text-slate-500">No assessments yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentReviews.map((r) => (
                <li key={r.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/academy/cases/${r.training_case_id}`}
                    className="font-medium text-amber-800 hover:underline truncate"
                  >
                    Case {String(r.training_case_id).slice(0, 8)}…
                  </Link>
                  <span className="text-slate-500">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                  </span>
                  <span className="text-slate-600">
                    Score {r.overall_score != null ? r.overall_score : "—"}{" "}
                    {r.ready_to_progress ? (
                      <span className="text-emerald-700 font-medium">· Ready</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4">
          <h2 className="text-sm font-semibold text-amber-950">Progression alerts</h2>
          <p className="mt-1 text-sm text-amber-950/80">
            {(inReview ?? 0) > 0
              ? `${inReview} case(s) marked in review — complete trainer assessments.`
              : "No cases flagged in review. Mark cases as “in review” when ready for sign-off."}
          </p>
        </section>
      </div>
    );
  }

  // Trainee view
  const doctor = await fetchTrainingDoctorForUser(supabase, access.userId);
  if (!doctor) {
    return (
      <div className="max-w-lg mx-auto px-4 text-center py-12">
        <p className="text-slate-700">No trainee profile is linked to your account yet.</p>
        <p className="mt-2 text-sm text-slate-500">Ask staff to set your auth user on the trainee record.</p>
      </div>
    );
  }

  const cases = await fetchTrainingCasesForDoctor(supabase, doctor.id);
  const caseIds = cases.map((c) => c.id);

  let metricsByCaseId = new Map<string, TrainingCaseMetricsRow>();
  let assessments: TrainingCaseAssessmentRow[] = [];
  if (caseIds.length) {
    const [{ data: mrows }, { data: arows }] = await Promise.all([
      supabase.from("training_case_metrics").select("*").in("training_case_id", caseIds),
      supabase.from("training_case_assessments").select("*").in("training_case_id", caseIds).order("created_at", { ascending: false }),
    ]);
    for (const m of mrows ?? []) metricsByCaseId.set(m.training_case_id, m as TrainingCaseMetricsRow);
    assessments = (arows ?? []) as TrainingCaseAssessmentRow[];
  }

  const snapshot = computeTraineeProgressSnapshot({
    doctor,
    metricsByCaseId,
    assessmentsNewestFirst: assessments,
  });

  const domainAvg = domainAveragesFromAssessments(assessments, 5);
  const tTrend = trendValuesFromCases(cases, metricsByCaseId, "transection_rate");
  const impTrend = trendValuesFromCases(cases, metricsByCaseId, "implantation_grafts_per_hour");
  const extTrend = trendValuesFromCases(cases, metricsByCaseId, "extraction_grafts_per_hour");

  const lastCase = cases.length ? cases[cases.length - 1] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your training</h1>
          <p className="mt-1 text-sm text-slate-600">{doctor.full_name}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClass(snapshot.badge)}`}>
          {snapshot.label}
        </span>
      </div>

      {snapshot.hints.length > 0 ? (
        <ul className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 list-disc list-inside">
          {snapshot.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Current stage</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{doctor.current_stage}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Cases logged</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{cases.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Last case</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {lastCase?.surgery_date ? lastCase.surgery_date : "—"}
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Performance trends</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">Transection rate</div>
            <Sparkline values={tTrend.length ? tTrend : [0]} strokeClassName="text-rose-600" fillClassName="text-rose-200/40" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Implantation grafts/hr</div>
            <Sparkline values={impTrend.length ? impTrend : [0]} strokeClassName="text-sky-600" fillClassName="text-sky-200/40" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Extraction grafts/hr</div>
            <Sparkline values={extTrend.length ? extTrend : [0]} strokeClassName="text-amber-600" fillClassName="text-amber-200/40" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Domain summary (recent reviews)</h2>
        {Object.keys(domainAvg).length === 0 ? (
          <p className="text-sm text-slate-500">No scored domains yet.</p>
        ) : (
          <ul className="space-y-2">
            {Object.entries(domainAvg).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                <span className="w-40 shrink-0 text-slate-600 truncate" title={k}>
                  {k.replace(/_/g, " ")}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${Math.min(100, (v / 5) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-slate-800 tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Your cases</h2>
        <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
          {cases.length === 0 ? (
            <li className="p-4 text-sm text-slate-500">No cases yet.</li>
          ) : (
            [...cases].reverse().map((c) => (
              <li key={c.id} className="p-3 flex justify-between gap-2 text-sm">
                <Link href={`/academy/cases/${c.id}`} className="font-medium text-amber-800 hover:underline">
                  {c.surgery_date} · {c.procedure_type || "FUE"}
                </Link>
                <span className="text-slate-500 capitalize">{c.status.replace(/_/g, " ")}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
