"use client";

import Link from "next/link";
import {
  DEVELOPMENTAL_LEVEL_LABELS,
  REVIEW_DISCLAIMER,
  type TrainingCaseReviewRow,
} from "@/lib/academy/trainingCaseReviews";

type Props = {
  review: TrainingCaseReviewRow;
  caseHref: string;
  compact?: boolean;
};

export default function TrainingCaseReviewSummaryCard({ review, caseHref, compact }: Props) {
  const levelLabel =
    review.overall_level && review.overall_level in DEVELOPMENTAL_LEVEL_LABELS
      ? DEVELOPMENTAL_LEVEL_LABELS[review.overall_level as keyof typeof DEVELOPMENTAL_LEVEL_LABELS]
      : review.overall_level;

  return (
    <div
      className={`rounded-xl border border-sky-200/90 bg-gradient-to-br from-sky-50/80 via-white to-white shadow-sm ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Training Case Feedback</p>
          <h3 className="text-sm font-semibold text-slate-900 mt-0.5">
            {review.case_date ? new Date(review.case_date).toLocaleDateString() : "Recent case"}
          </h3>
        </div>
        {levelLabel ? (
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900 ring-1 ring-sky-200">
            {levelLabel}
          </span>
        ) : null}
      </div>

      {!compact ? <p className="mt-3 text-xs text-slate-600 leading-relaxed">{REVIEW_DISCLAIMER}</p> : null}

      {review.recommended_next_focus ? (
        <div className="mt-3 rounded-lg bg-amber-50/80 border border-amber-100 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">Priority next focus</div>
          <p className="text-sm text-amber-950 mt-0.5">{review.recommended_next_focus}</p>
        </div>
      ) : null}

      {review.summary && !compact ? (
        <p className="mt-3 text-sm text-slate-700 line-clamp-3">{review.summary}</p>
      ) : null}

      <Link
        href={caseHref}
        className="mt-4 inline-flex text-sm font-semibold text-amber-700 hover:text-amber-800 hover:underline"
      >
        View full feedback →
      </Link>
    </div>
  );
}
