import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import {
  createDraftTrainingCaseReview,
  fetchTrainingCaseReviewBundle,
  fetchTrainingCaseReviewsForCase,
} from "@/lib/academy/trainingCaseReviews";
import TrainingCaseReviewForm from "@/components/academy/training-case-reviews/TrainingCaseReviewForm";
import type { TrainingCaseUploadRow } from "@/lib/academy/types";

export const dynamic = "force-dynamic";

export default async function TrainingCaseReviewEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ reviewId?: string }>;
}) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!access.isStaff) redirect(`/academy/training-cases/${(await params).caseId}`);

  const { caseId } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseAuthServerClient();

  const { data: c, error: cErr } = await supabase
    .from("training_cases")
    .select("id, training_doctor_id, surgery_date, procedure_type")
    .eq("id", caseId)
    .maybeSingle();
  if (cErr || !c) notFound();

  const { data: doctor } = await supabase
    .from("training_doctors")
    .select("full_name, program_id, current_stage")
    .eq("id", c.training_doctor_id)
    .maybeSingle();

  let reviewId = sp.reviewId;
  if (!reviewId) {
    const existing = await fetchTrainingCaseReviewsForCase(supabase, caseId);
    const draft = existing.find((r) => r.review_status === "draft" && r.reviewer_id === access.userId);
    if (draft) {
      reviewId = draft.id;
    } else {
      const { data: cohortLink } = await supabase
        .from("training_cohort_trainees")
        .select("cohort_id")
        .eq("training_doctor_id", c.training_doctor_id)
        .limit(1)
        .maybeSingle();

      const created = await createDraftTrainingCaseReview(supabase, {
        trainingCaseId: caseId,
        traineeId: c.training_doctor_id,
        reviewerId: access.userId,
        programId: doctor?.program_id ?? null,
        cohortId: cohortLink?.cohort_id ?? null,
        caseDate: c.surgery_date,
        caseType: c.procedure_type,
        traineeStage: doctor?.current_stage ?? null,
      });
      reviewId = created.id;
    }
  }

  const bundle = await fetchTrainingCaseReviewBundle(supabase, reviewId);
  if (!bundle) notFound();
  if (bundle.review.review_status !== "draft") {
    redirect(`/academy/training-cases/${caseId}?reviewId=${reviewId}`);
  }

  const { data: uploads } = await supabase
    .from("training_case_uploads")
    .select("*")
    .eq("training_case_id", caseId)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6 pb-10">
      <div>
        <Link href={`/academy/training-cases/${caseId}`} className="text-sm font-medium text-amber-700 hover:underline">
          ← Case feedback
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Training Case Review</h1>
        <p className="mt-1 text-sm text-slate-600">
          {doctor?.full_name ?? "Trainee"} · developmental coaching feedback (internal)
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <TrainingCaseReviewForm
          caseId={caseId}
          reviewId={reviewId}
          initial={bundle}
          uploads={(uploads ?? []) as TrainingCaseUploadRow[]}
        />
      </div>
    </div>
  );
}
