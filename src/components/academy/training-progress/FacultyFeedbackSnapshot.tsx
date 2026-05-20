import Link from "next/link";
import { DEVELOPMENTAL_LEVEL_LABELS, REVIEW_DISCLAIMER, type TrainingCaseReviewRow } from "@/lib/academy/trainingCaseReviews";

type Props = {
  review: TrainingCaseReviewRow | null;
  caseHref?: string;
};

export default function FacultyFeedbackSnapshot({ review, caseHref }: Props) {
  if (!review) {
    return (
      <section className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/60 via-white to-white p-6 shadow-sm ring-1 ring-sky-100">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-800/80">Faculty feedback snapshot</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Latest coaching summary</h2>
        <p className="mt-3 text-sm text-slate-500">
          When faculty submit a Training Case Review, their summary, strengths, and recommended next focus will appear here.
        </p>
      </section>
    );
  }

  const levelLabel =
    review.overall_level && review.overall_level in DEVELOPMENTAL_LEVEL_LABELS
      ? DEVELOPMENTAL_LEVEL_LABELS[review.overall_level as keyof typeof DEVELOPMENTAL_LEVEL_LABELS]
      : review.overall_level;

  const href =
    caseHref ??
    (review.training_case_id
      ? `/academy/training-cases/${review.training_case_id}?reviewId=${review.id}`
      : "/academy/training-cases");

  return (
    <section className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/60 via-white to-white p-6 shadow-sm ring-1 ring-sky-100">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-800/80">Faculty feedback snapshot</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Latest coaching summary</h2>
          {review.submitted_at ? (
            <p className="mt-1 text-xs text-slate-500">Submitted {new Date(review.submitted_at).toLocaleDateString()}</p>
          ) : null}
        </div>
        {levelLabel ? (
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900 ring-1 ring-sky-200">
            {levelLabel}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-slate-500 leading-relaxed">{REVIEW_DISCLAIMER}</p>

      <div className="mt-4 space-y-4 text-sm">
        <FeedbackField label="What went well" text={review.main_strengths?.join(" · ") ?? review.summary} />
        <FeedbackField label="Key improvement point" text={review.improvement_priorities?.[0] ?? null} />
        <FeedbackField label="Recommended next case focus" text={review.recommended_next_focus} />
        <FeedbackField label="Faculty recommendation" text={review.faculty_recommendation} />
      </div>

      <Link href={href} className="mt-5 inline-flex text-sm font-semibold text-amber-800 hover:underline">
        View full review →
      </Link>
    </section>
  );
}

function FeedbackField({ label, text }: { label: string; text: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      {text?.trim() ? (
        <p className="mt-1 text-slate-800 leading-relaxed whitespace-pre-wrap">{text.trim()}</p>
      ) : (
        <p className="mt-1 text-slate-400 text-xs">Not captured in this review.</p>
      )}
    </div>
  );
}
