import type { CertificationProgress } from "@/lib/certificationProgress";
import type { CertificationResult } from "@/lib/certification";

type Props = {
  progress: CertificationProgress;
  /** When provided (e.g. clinic dashboard), shows score, eligible cases, helping/limiting reasons. */
  certificationResult?: CertificationResult | null;
};

export default function CertificationProgressCard({ progress, certificationResult }: Props) {
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
      {certificationResult != null && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>Certification score</span>
          <span className="font-medium text-slate-900">{certificationResult.score.toFixed(1)}</span>
          <span>Eligible public cases</span>
          <span className="font-medium text-slate-900">{certificationResult.metrics.eligiblePublicCaseCount}</span>
        </div>
      )}
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
      {certificationResult != null && (certificationResult.helpingReasons.length > 0 || certificationResult.limitingReasons.length > 0) ? (
        <div className="mt-2 space-y-1">
          {certificationResult.helpingReasons.length > 0 && (
            <p className="text-xs text-emerald-700">
              Helping: {certificationResult.helpingReasons.join("; ")}
            </p>
          )}
          {certificationResult.limitingReasons.length > 0 && (
            <p className="text-xs text-amber-700">
              To reach next tier: {certificationResult.limitingReasons.join("; ")}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">{guidanceText}</p>
      )}
    </div>
  );
}
