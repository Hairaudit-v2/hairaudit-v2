import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import AcademyMetricsForm from "@/components/academy/AcademyMetricsForm";
import AcademyCaseStatusControl from "@/components/academy/AcademyCaseStatusControl";
import AcademyCaseUploadBar from "@/components/academy/AcademyCaseUploadBar";
import type { TrainingCaseUploadRow } from "@/lib/academy/types";

export const dynamic = "force-dynamic";

export default async function AcademyCaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");

  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();

  const { data: c, error: cErr } = await supabase.from("training_cases").select("*").eq("id", caseId).maybeSingle();
  if (cErr || !c) notFound();

  const { data: doctor } = await supabase
    .from("training_doctors")
    .select("id, full_name")
    .eq("id", c.training_doctor_id)
    .maybeSingle();

  const [{ data: uploads }, { data: metrics }, { data: assessments }] = await Promise.all([
    supabase.from("training_case_uploads").select("*").eq("training_case_id", caseId).order("created_at", { ascending: true }),
    supabase.from("training_case_metrics").select("*").eq("training_case_id", caseId).maybeSingle(),
    supabase.from("training_case_assessments").select("*").eq("training_case_id", caseId).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/academy/trainees/${c.training_doctor_id}`} className="text-sm font-medium text-amber-700 hover:underline">
            ← {doctor?.full_name ?? "Trainee"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Training case</h1>
          <p className="mt-1 text-sm text-slate-600">
            {c.surgery_date} · {c.procedure_type || "FUE"} ·{" "}
            <span className="capitalize">{String(c.status).replace(/_/g, " ")}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {access.isStaff ? <AcademyCaseStatusControl caseId={caseId} current={c.status} /> : null}
          {access.isStaff ? (
            <Link href={`/academy/cases/${caseId}/review`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              Trainer review →
            </Link>
          ) : null}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Photos</h2>
        <AcademyCaseUploadBar
          caseId={caseId}
          initialUploads={(uploads ?? []) as TrainingCaseUploadRow[]}
          viewerUserId={access.userId}
          isStaff={access.isStaff}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {access.isStaff ? (
          <AcademyMetricsForm caseId={caseId} initial={(metrics ?? {}) as Record<string, string | number | null | undefined>} />
        ) : metrics ? (
          <div className="text-sm text-slate-700 space-y-1">
            <div className="font-semibold text-slate-900 mb-2">Metrics</div>
            <pre className="text-xs bg-slate-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(metrics, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Metrics not entered yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Assessments</h2>
        {!assessments?.length ? (
          <p className="text-sm text-slate-500">No reviews yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {assessments.map((a) => (
              <li key={a.id} className="border-b border-slate-100 pb-3">
                <div className="font-medium text-slate-800">
                  {a.stage_at_assessment} · overall {a.overall_score ?? "—"}{" "}
                  {a.ready_to_progress ? <span className="text-emerald-700">· Ready</span> : null}
                </div>
                {a.strengths ? <p className="mt-1 text-slate-600">Strengths: {a.strengths}</p> : null}
                {a.weaknesses ? <p className="text-slate-600">Weaknesses: {a.weaknesses}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
