import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import { fetchTrainingCasesForDoctor } from "@/lib/academy/queries";
import {
  computeTraineeProgressSnapshot,
  domainAveragesFromAssessments,
  trendValuesFromCases,
} from "@/lib/academy/progression";
import type { TrainingCaseMetricsRow, TrainingCaseAssessmentRow } from "@/lib/academy/types";
import Sparkline from "@/components/ui/Sparkline";

export const dynamic = "force-dynamic";

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

export default async function TraineeDetailPage({ params }: { params: Promise<{ doctorId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");

  const { doctorId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: doctor, error } = await supabase.from("training_doctors").select("*").eq("id", doctorId).maybeSingle();

  if (error || !doctor) notFound();

  const cases = await fetchTrainingCasesForDoctor(supabase, doctorId);
  const caseIds = cases.map((c) => c.id);

  let metricsByCaseId = new Map<string, TrainingCaseMetricsRow>();
  let assessments: TrainingCaseAssessmentRow[] = [];
  const { data: history } = await supabase
    .from("training_stage_history")
    .select("*")
    .eq("training_doctor_id", doctorId)
    .order("changed_at", { ascending: false });

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/academy/trainees" className="text-sm font-medium text-amber-700 hover:underline">
            ← Trainees
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{doctor.full_name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {doctor.email || "No email"} · {doctor.current_stage} ·{" "}
            <span className="capitalize">{doctor.status}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClass(snapshot.badge)}`}>
            {snapshot.label}
          </span>
          <div className="flex flex-col items-end gap-1">
            <Link
              href={`/academy/trainees/${doctorId}/competency`}
              className="text-sm font-semibold text-slate-800 hover:text-amber-800"
            >
              Competency dashboard →
            </Link>
            {access.isStaff ? (
              <Link
                href={`/academy/trainees/${doctorId}/new-case`}
                className="text-sm font-semibold text-amber-700 hover:text-amber-800"
              >
                + New training case
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {doctor.notes ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trainer notes</h2>
          <p className="mt-2 whitespace-pre-wrap">{doctor.notes}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Trends</h2>
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
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Domain summary</h2>
        {Object.keys(domainAvg).length === 0 ? (
          <p className="text-sm text-slate-500">No assessments yet.</p>
        ) : (
          <ul className="space-y-2">
            {Object.entries(domainAvg).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                <span className="w-44 shrink-0 text-slate-600 truncate">{k.replace(/_/g, " ")}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, (v / 5) * 100)}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Progress history</h2>
        {!history?.length ? (
          <p className="text-sm text-slate-500">No stage changes recorded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{new Date(h.changed_at).toLocaleString()}</span>
                <span className="font-medium text-slate-800">
                  {h.from_stage || "—"} → {h.to_stage}
                </span>
                {h.reason ? <span className="text-slate-600">{h.reason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Cases</h2>
        <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
          {cases.length === 0 ? (
            <li className="p-4 text-sm text-slate-500">No cases yet.</li>
          ) : (
            [...cases].reverse().map((c) => (
              <li key={c.id} className="p-3 flex flex-wrap justify-between gap-2 text-sm">
                <Link href={`/academy/cases/${c.id}`} className="font-medium text-amber-800 hover:underline">
                  {c.surgery_date} · {c.procedure_type || "FUE"}
                </Link>
                <span className="text-slate-500 capitalize">{c.status.replace(/_/g, " ")}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-xs text-slate-500">
        <div className="font-semibold text-slate-700 text-sm mb-2">Photo checklist (per case)</div>
        <p>Open a case to upload. Types use the canonical format training_photo:category in storage records.</p>
        <ul className="mt-2 list-disc list-inside">
          <li>Required: preop_front, preop_sides, donor_rear, intraop_extraction, intraop_implantation, postop_day0</li>
          <li>Optional: preop_crown, hairline_design, graft_tray, donor_closeup, recipient_closeup</li>
        </ul>
      </section>
    </div>
  );
}
