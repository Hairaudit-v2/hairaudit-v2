import Link from "next/link";
import { CASE_DIFFICULTY_LABELS } from "@/lib/academy/trainingCaseReviews";
import type { TimelineEntry } from "@/lib/academy/trainingCaseReviews";

type Props = {
  entries: TimelineEntry[];
  isStaff?: boolean;
};

function difficultyLabel(d: string | null): string | null {
  if (!d) return null;
  if (d in CASE_DIFFICULTY_LABELS) return CASE_DIFFICULTY_LABELS[d as keyof typeof CASE_DIFFICULTY_LABELS];
  return d.replace(/_/g, " ");
}

export default function TrainingCaseReviewTimeline({ entries, isStaff }: Props) {
  if (!entries.length) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 px-6 py-8 text-center">
        <p className="text-sm font-medium text-slate-700">No submitted case reviews yet</p>
        <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
          Your timeline will show each faculty Training Case Review as they are submitted, so you can see progress from case
          to case.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Case review history</p>
        <h2 className="text-xl font-semibold text-slate-900">Timeline</h2>
      </div>
      <ol className="relative space-y-0 border-l-2 border-emerald-200/80 ml-3 pl-6">
        {entries.map((entry, i) => {
          const href = entry.caseId
            ? `/academy/training-cases/${entry.caseId}?reviewId=${entry.reviewId}`
            : `/academy/training-cases`;
          const dateLabel = entry.caseDate
            ? new Date(entry.caseDate).toLocaleDateString()
            : entry.submittedAt
              ? new Date(entry.submittedAt).toLocaleDateString()
              : "—";

          return (
            <li key={entry.reviewId} className="relative pb-8 last:pb-0">
              <span
                className={`absolute -left-[1.65rem] top-1 flex h-3 w-3 rounded-full ring-2 ring-white ${
                  i === 0 ? "bg-emerald-500" : "bg-emerald-300"
                }`}
              />
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{dateLabel}</p>
                    <p className="text-xs text-slate-500">
                      {entry.caseType ?? "Training case"}
                      {entry.caseDifficulty ? ` · ${difficultyLabel(entry.caseDifficulty)}` : ""}
                    </p>
                  </div>
                  {entry.overallLevelLabel ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200">
                      {entry.overallLevelLabel}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                  {entry.topStrength ? (
                    <div className="rounded-lg bg-emerald-50/80 px-3 py-2">
                      <span className="font-semibold text-emerald-800">Top strength · </span>
                      <span className="text-emerald-900">{entry.topStrength}</span>
                    </div>
                  ) : null}
                  {entry.topImprovementPriority ? (
                    <div className="rounded-lg bg-amber-50/80 px-3 py-2">
                      <span className="font-semibold text-amber-800">Next focus · </span>
                      <span className="text-amber-900">{entry.topImprovementPriority}</span>
                    </div>
                  ) : null}
                </div>
                <Link href={href} className="mt-3 inline-flex text-sm font-semibold text-amber-800 hover:underline">
                  {isStaff ? "View full review →" : "View your feedback →"}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
