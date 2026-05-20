import type { TraineeSurgicalProgressDashboard } from "@/lib/academy/trainingCaseReviews/dashboard";

type Props = {
  traineeName: string;
  programName: string | null;
  cohortLabel: string | null;
  siteLabel: string | null;
  currentStage: string;
  competencyWeek: number | null;
  progress: TraineeSurgicalProgressDashboard;
  overallProgressPct: number;
};

function formatStage(s: string) {
  return s.replace(/_/g, " ");
}

export default function TraineeProgressHero({
  traineeName,
  programName,
  cohortLabel,
  siteLabel,
  currentStage,
  competencyWeek,
  progress,
  overallProgressPct,
}: Props) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-emerald-800/40 bg-gradient-to-br from-[#0a1f1a] via-[#0f2e28] to-[#143528] shadow-2xl ring-1 ring-emerald-400/10">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/95">
              Your surgical progress over time
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{traineeName}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-emerald-100/90">
              <span>
                <span className="text-emerald-400/70">Program</span> · {programName ?? "Not linked"}
              </span>
              {cohortLabel ? (
                <span>
                  <span className="text-emerald-400/70">Cohort</span> · {cohortLabel}
                </span>
              ) : null}
              {siteLabel ? (
                <span>
                  <span className="text-emerald-400/70">Site</span> · {siteLabel}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">Current stage</div>
              <div className="text-lg font-semibold capitalize text-white">{formatStage(currentStage)}</div>
              {competencyWeek != null ? (
                <div className="mt-1 text-xs text-amber-200/90">Training week {competencyWeek} of 4</div>
              ) : null}
            </div>
            {progress.latestOverallLevelLabel ? (
              <span className="inline-flex rounded-full bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-400/30">
                Latest review: {progress.latestOverallLevelLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/80">Training summary</p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-50/95">{progress.encouragingSummary}</p>
            {progress.recommendedNextFocus[0] ? (
              <p className="mt-3 text-xs text-emerald-200/90">
                <span className="font-semibold text-emerald-100">Latest recommended next focus · </span>
                {progress.recommendedNextFocus[0]}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300/70">Case review progress</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-semibold text-white tabular-nums">{overallProgressPct}%</span>
              <span className="pb-1 text-xs text-emerald-200/70">
                {progress.reviewCount} submitted review{progress.reviewCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-950/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-200 transition-all duration-500"
                style={{ width: `${Math.min(100, overallProgressPct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
