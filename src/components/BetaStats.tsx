const PLACEHOLDER_STATS = {
  audits_completed: 1247,
  clinics_participating: 43,
  surgeons_reviewed: 89,
  countries_represented: 12,
} as const;

const LABELS: Record<keyof typeof PLACEHOLDER_STATS, string> = {
  audits_completed: "Audits completed",
  clinics_participating: "Clinics participating",
  surgeons_reviewed: "Surgeons reviewed",
  countries_represented: "Countries represented",
};

export default function BetaStats() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {(Object.keys(PLACEHOLDER_STATS) as (keyof typeof PLACEHOLDER_STATS)[]).map((key) => (
        <div
          key={key}
          className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-center"
        >
          <p className="text-2xl sm:text-3xl font-bold text-amber-300 tabular-nums">
            {PLACEHOLDER_STATS[key].toLocaleString()}
          </p>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 font-medium">
            {LABELS[key]}
          </p>
        </div>
      ))}
    </div>
  );
}
