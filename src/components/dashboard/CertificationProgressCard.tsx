import type { CertificationProgress } from "@/lib/certificationProgress";

export default function CertificationProgressCard({ progress }: { progress: CertificationProgress }) {
  const { currentTier, nextTier, currentCount, nextTierThreshold, progressPct, guidanceText } = progress;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Certification progress</h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-lg font-bold text-slate-900">{currentTier ?? "—"}</span>
        {nextTier && (
          <span className="text-sm text-slate-500">
            → next: {nextTier}
            {nextTierThreshold != null && (
              <span className="ml-1 text-slate-400">
                ({currentCount}/{nextTierThreshold})
              </span>
            )}
          </span>
        )}
      </div>
      {nextTier && progressPct < 100 && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all"
            style={{ width: `${Math.min(100, progressPct)}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}
      {nextTier && progressPct < 100 && (
        <p className="mt-2 text-xs text-slate-600">{progressPct}% toward {nextTier}</p>
      )}
      <p className="mt-2 text-sm text-slate-600">{guidanceText}</p>
    </div>
  );
}
