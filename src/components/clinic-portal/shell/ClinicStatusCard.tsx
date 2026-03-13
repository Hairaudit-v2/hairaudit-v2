type StatusChip = {
  label: string;
  ready: boolean;
};

export default function ClinicStatusCard({
  trustStatus,
  completionPercent,
  onboardingSteps,
  statusChips,
}: {
  trustStatus: string;
  completionPercent: number;
  onboardingSteps: number;
  statusChips: StatusChip[];
}) {
  return (
    <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Trust and Readiness</p>
      <p className="mt-2 text-sm font-semibold text-white">{trustStatus}</p>
      <p className="mt-1 text-xs text-slate-300">Onboarding steps completed: {onboardingSteps}/5</p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
          style={{ width: `${Math.max(0, Math.min(100, completionPercent))}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">Profile completion: {completionPercent}%</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {statusChips.map((chip) => (
          <span
            key={chip.label}
            className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              chip.ready
                ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
                : "border-amber-300/40 bg-amber-400/20 text-amber-100"
            }`}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </section>
  );
}
