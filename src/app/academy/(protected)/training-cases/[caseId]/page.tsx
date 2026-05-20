import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import {
  fetchTrainingCaseReviewBundle,
  fetchTrainingCaseReviewsForCase,
  DEVELOPMENTAL_LEVEL_LABELS,
  REVIEW_DISCLAIMER,
} from "@/lib/academy/trainingCaseReviews";
import { fetchCompetencyLinksForReview } from "@/lib/academy/competencyReviewTraceability";
import TrainingCaseReviewSummaryCard from "@/components/academy/training-case-reviews/TrainingCaseReviewSummaryCard";
import TrainingCaseReviewSections from "@/components/academy/training-case-reviews/TrainingCaseReviewSections";
import CompetencyTraceabilityPanel from "@/components/academy/CompetencyTraceabilityPanel";
import { isActiveTrainingCaseUpload } from "@/lib/academy/trainingCaseUploads";
import { isActiveTrainingCase } from "@/lib/academy/trainingCases";
import type { TrainingCaseUploadRow } from "@/lib/academy/types";
import { REVIEW_IMAGE_CATEGORIES } from "@/lib/academy/trainingCaseReviews";
import AcademySignedThumb from "@/components/academy/AcademySignedThumb";

export const dynamic = "force-dynamic";

export default async function TrainingCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ reviewId?: string }>;
}) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");

  const { caseId } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseAuthServerClient();

  const { data: c, error: cErr } = await supabase.from("training_cases").select("*").eq("id", caseId).maybeSingle();
  if (cErr || !c || !isActiveTrainingCase(c)) notFound();

  const [{ data: doctor }, { data: uploads }, reviews] = await Promise.all([
    supabase.from("training_doctors").select("id, full_name, current_stage").eq("id", c.training_doctor_id).maybeSingle(),
    supabase.from("training_case_uploads").select("*").eq("training_case_id", caseId).order("created_at", { ascending: true }),
    fetchTrainingCaseReviewsForCase(supabase, caseId).catch(() => []),
  ]);

  const visibleReviews = access.isStaff ? reviews : reviews.filter((r) => r.review_status === "submitted");
  const selectedReviewId = sp.reviewId ?? visibleReviews.find((r) => r.review_status === "submitted")?.id ?? visibleReviews[0]?.id;
  const bundle = selectedReviewId ? await fetchTrainingCaseReviewBundle(supabase, selectedReviewId).catch(() => null) : null;

  const competencyLinks =
    access.isStaff && bundle?.review.id
      ? await fetchCompetencyLinksForReview(supabase, bundle.review.id).catch(() => [])
      : [];

  const draftReview = access.isStaff ? reviews.find((r) => r.review_status === "draft") : null;

  const activeUploads = ((uploads ?? []) as TrainingCaseUploadRow[]).filter(isActiveTrainingCaseUpload);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/academy/training-cases" className="text-sm font-medium text-amber-700 hover:underline">
            ← Training Case Review
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Training case feedback</h1>
          <p className="mt-1 text-sm text-slate-600">
            {doctor?.full_name ?? "Trainee"} · {c.surgery_date} · {c.procedure_type || "FUE"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href={`/academy/cases/${caseId}`} className="text-sm text-slate-600 hover:text-slate-800 hover:underline">
            Open case photos & metrics →
          </Link>
          {access.isStaff ? (
            <Link
              href={`/academy/cases/${caseId}/edit`}
              className="text-sm font-semibold text-slate-800 hover:text-slate-900 hover:underline"
            >
              Correct case data →
            </Link>
          ) : null}
          {access.isStaff ? (
            draftReview ? (
              <Link
                href={`/academy/training-cases/${caseId}/review?reviewId=${draftReview.id}`}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Continue draft review
              </Link>
            ) : (
              <Link
                href={`/academy/training-cases/${caseId}/review`}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Create training case review
              </Link>
            )
          ) : null}
        </div>
      </div>

      {visibleReviews.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {visibleReviews.map((r) => (
            <Link
              key={r.id}
              href={`/academy/training-cases/${caseId}?reviewId=${r.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                r.id === selectedReviewId
                  ? "bg-amber-100 text-amber-900 ring-amber-200"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {r.review_status === "submitted" && r.submitted_at
                ? new Date(r.submitted_at).toLocaleDateString()
                : "Draft"}
            </Link>
          ))}
        </div>
      ) : null}

      {!bundle || (!access.isStaff && bundle.review.review_status !== "submitted") ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          {access.isStaff
            ? "No review selected. Create a training case review to provide developmental feedback."
            : "Faculty have not submitted feedback for this case yet."}
        </div>
      ) : (
        <>
          <TrainingCaseReviewSummaryCard review={bundle.review} caseHref={`/academy/training-cases/${caseId}?reviewId=${bundle.review.id}`} />

          {access.isStaff ? (
            <CompetencyTraceabilityPanel traineeId={c.training_doctor_id} links={competencyLinks} />
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Overall summary</h2>
            <p className="text-xs text-slate-500">{REVIEW_DISCLAIMER}</p>
            {bundle.review.summary ? <p className="text-sm text-slate-700 whitespace-pre-wrap">{bundle.review.summary}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {bundle.review.case_difficulty ? (
                <div>
                  <span className="text-slate-500">Case difficulty · </span>
                  <span className="text-slate-800 capitalize">{bundle.review.case_difficulty.replace(/_/g, " ")}</span>
                </div>
              ) : null}
              {bundle.review.trainee_stage ? (
                <div>
                  <span className="text-slate-500">Trainee stage · </span>
                  <span className="text-slate-800">{bundle.review.trainee_stage}</span>
                </div>
              ) : null}
            </div>
            {bundle.review.main_strengths?.length ? (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase">Main strengths</div>
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                  {bundle.review.main_strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {bundle.review.improvement_priorities?.length ? (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase">Improvement priorities</div>
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                  {bundle.review.improvement_priorities.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {bundle.review.faculty_recommendation ? (
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-800">
                <span className="font-medium">Faculty recommendation · </span>
                {bundle.review.faculty_recommendation}
              </div>
            ) : null}
            {bundle.review.overall_level ? (
              <div className="text-sm">
                <span className="text-slate-500">Overall level · </span>
                <span className="font-medium text-sky-900">
                  {bundle.review.overall_level in DEVELOPMENTAL_LEVEL_LABELS
                    ? DEVELOPMENTAL_LEVEL_LABELS[bundle.review.overall_level as keyof typeof DEVELOPMENTAL_LEVEL_LABELS]
                    : bundle.review.overall_level}
                </span>
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Category feedback</h2>
            <TrainingCaseReviewSections sections={bundle.sections} readOnly />
          </section>

          {bundle.images.length ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Image comments</h2>
              {bundle.images.map((img) => {
                const catLabel = REVIEW_IMAGE_CATEGORIES.find((c) => c.key === img.image_category)?.title ?? img.image_category;
                const upload = activeUploads.find((u) => u.id === img.image_id);
                return (
                  <div key={img.id} className="border-b border-slate-100 pb-3 last:border-0">
                    <div className="text-sm font-medium text-slate-800">{catLabel}</div>
                    {upload ? (
                      <div className="mt-2 max-w-[200px]">
                        <AcademySignedThumb storagePath={upload.storage_path} label={catLabel} />
                      </div>
                    ) : img.image_id ? (
                      <p className="mt-2 text-xs text-slate-500 italic">Linked evidence has been removed.</p>
                    ) : null}
                    {img.reviewer_comment ? <p className="mt-2 text-sm text-slate-700">{img.reviewer_comment}</p> : null}
                  </div>
                );
              })}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
