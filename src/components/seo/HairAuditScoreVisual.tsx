type HairAuditScoreVisualProps = {
  score?: number;
  label?: string;
  className?: string;
};

function getScoreLabel(score: number) {
  if (score >= 85) return "Excellent quality signals";
  if (score >= 70) return "Strong quality signals";
  if (score >= 55) return "Mixed quality signals";
  return "Needs closer review";
}

export default function HairAuditScoreVisual({
  score = 82,
  label,
  className = "",
}: HairAuditScoreVisualProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const derivedLabel = label ?? getScoreLabel(clamped);

  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-900/70 p-5 ${className}`}>
      <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">HairAudit Score</p>
      <div className="mt-3 flex items-end gap-3">
        <p className="text-4xl font-bold text-white leading-none">{clamped}</p>
        <p className="text-sm text-slate-300 mb-1">/ 100</p>
      </div>

      <div className="mt-4 h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400"
          style={{ width: `${clamped}%` }}
          aria-label={`Score bar showing ${clamped} out of 100`}
        />
      </div>

      <p className="mt-3 text-sm text-emerald-200 font-medium">{derivedLabel}</p>
      <p className="mt-3 text-xs text-slate-400">
        Simplified summary for sharing. Full report includes evidence notes and confidence details.
      </p>
    </div>
  );
}
