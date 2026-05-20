import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import { fetchTrainingCaseReviewsList } from "@/lib/academy/trainingCaseReviews";
import { DEVELOPMENTAL_LEVEL_LABELS } from "@/lib/academy/trainingCaseReviews";
import { isActiveTrainingCase } from "@/lib/academy/trainingCases";

export const dynamic = "force-dynamic";

export default async function TrainingCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; trainee?: string }>;
}) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");

  const sp = await searchParams;
  const supabase = await createSupabaseAuthServerClient();

  const reviews = await fetchTrainingCaseReviewsList(supabase, {
    status: sp.status || undefined,
    traineeId: sp.trainee || undefined,
    limit: 50,
  }).catch(() => []);

  const caseIds = [...new Set(reviews.map((r) => r.training_case_id).filter(Boolean))] as string[];
  const traineeIds = [...new Set(reviews.map((r) => r.trainee_id))];

  const [{ data: cases }, { data: trainees }] = await Promise.all([
    caseIds.length
      ? supabase.from("training_cases").select("id, surgery_date, procedure_type, status, deleted_at").in("id", caseIds)
      : Promise.resolve({ data: [] }),
    traineeIds.length
      ? supabase.from("training_doctors").select("id, full_name").in("id", traineeIds)
      : Promise.resolve({ data: [] }),
  ]);

  const caseById = new Map((cases ?? []).filter(isActiveTrainingCase).map((c) => [c.id, c]));
  const traineeById = new Map((trainees ?? []).map((t) => [t.id, t]));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8 pb-10">
      <div>
        <Link href="/academy/dashboard" className="text-sm font-medium text-amber-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Training Case Review</h1>
        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
          Educational surgical feedback for trainee progression — internal coaching, not a patient HairAudit report.
        </p>
      </div>

      {access.isStaff ? (
        <form method="get" className="flex flex-wrap gap-3 items-end rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600">Status</label>
            <select name="status" defaultValue={sp.status ?? ""} className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>
          <button type="submit" className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-900">
            Filter
          </button>
          <Link href="/academy/trainees" className="ml-auto text-sm font-medium text-amber-700 hover:underline">
            Open trainee list →
          </Link>
        </form>
      ) : null}

      {!reviews.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          {access.isStaff
            ? "No training case reviews yet. Open a training case and start a review from the case page."
            : "No submitted feedback yet. Faculty will share coaching feedback here after reviewing your cases."}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {reviews.map((r) => {
            const c = r.training_case_id ? caseById.get(r.training_case_id) : null;
            const t = traineeById.get(r.trainee_id);
            const levelLabel =
              r.overall_level && r.overall_level in DEVELOPMENTAL_LEVEL_LABELS
                ? DEVELOPMENTAL_LEVEL_LABELS[r.overall_level as keyof typeof DEVELOPMENTAL_LEVEL_LABELS]
                : r.overall_level;
            const href = r.training_case_id
              ? `/academy/training-cases/${r.training_case_id}${access.isStaff && r.review_status === "draft" ? "/review" : ""}?reviewId=${r.id}`
              : "#";
            return (
              <li key={r.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <Link href={href} className="font-medium text-amber-800 hover:underline">
                    {t?.full_name ?? "Trainee"} · {c?.surgery_date ?? r.case_date ?? "Case"}
                  </Link>
                  <div className="text-xs text-slate-500 mt-0.5 capitalize">
                    {r.review_status.replace(/_/g, " ")}
                    {levelLabel ? ` · ${levelLabel}` : ""}
                  </div>
                </div>
                <span className="text-slate-500 text-xs">
                  {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : new Date(r.updated_at).toLocaleDateString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
