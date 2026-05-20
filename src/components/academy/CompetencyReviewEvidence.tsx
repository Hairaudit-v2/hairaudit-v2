"use client";

import Link from "next/link";
import type { ReviewEvidenceView } from "@/lib/academy/competencyReviewTraceability";
import type { TrainingCaseReviewRow } from "@/lib/academy/trainingCaseReviews/types";
import { formatReviewEvidenceLabel } from "@/lib/academy/competencyReviewTraceability";

export function CompetencyReviewEvidenceLink({
  reviewId,
  reviewEvidence,
  className = "text-xs font-semibold text-sky-800 hover:underline",
}: {
  reviewId: string | null | undefined;
  reviewEvidence?: ReviewEvidenceView;
  className?: string;
}) {
  if (!reviewId) return null;

  if (!reviewEvidence) {
    return <span className="text-xs text-slate-500 italic">Faculty review not yet released.</span>;
  }

  if (!reviewEvidence.canView || !reviewEvidence.href) {
    return <span className="text-xs text-slate-500 italic">Faculty review not yet released.</span>;
  }

  return (
    <Link href={reviewEvidence.href} className={className}>
      View supporting case feedback
      {reviewEvidence.reviewStatus !== "submitted" ? " (faculty draft)" : ""}
    </Link>
  );
}

export function TrainingCaseReviewEvidenceSelect({
  reviews,
  value,
  onChange,
  selectedCaseId,
  label = "Supporting case review (optional)",
  hint = "This review may support faculty competency decisions. Competency sign-off remains a separate faculty decision.",
}: {
  reviews: TrainingCaseReviewRow[];
  value: string;
  onChange: (reviewId: string) => void;
  selectedCaseId?: string;
  label?: string;
  hint?: string;
}) {
  const filtered = selectedCaseId
    ? reviews.filter((r) => r.training_case_id === selectedCaseId || !r.training_case_id)
    : reviews;
  const selected = filtered.find((r) => r.id === value);

  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">— None —</option>
        {filtered.map((r) => (
          <option key={r.id} value={r.id}>
            {formatReviewEvidenceLabel(r)}
          </option>
        ))}
      </select>
      {selected?.training_case_id ? (
        <Link
          href={`/academy/training-cases/${selected.training_case_id}?reviewId=${selected.id}`}
          className="mt-1 inline-block text-[11px] font-semibold text-amber-800 hover:underline"
        >
          Open case review →
        </Link>
      ) : null}
      <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>
    </div>
  );
}
