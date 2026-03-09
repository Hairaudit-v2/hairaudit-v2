import type { AwardTier } from "@/lib/transparency/awardRules";

export type ClinicTransparencyProfile = {
  transparency_score?: number | null;
  audited_case_count?: number | null;
  contributed_case_count?: number | null;
  validated_case_count?: number | null;
  provisional_high_score_count?: number | null;
  benchmark_eligible_validated_count?: number | null;
  benchmark_eligible_count?: number | null;
  average_forensic_score?: number | null;
  documentation_integrity_average?: number | null;
  current_award_tier?: string | null;
  award_progression_paused?: boolean | null;
  volume_confidence_score?: number | null;
  low_score_case_count?: number | null;
};

export type ClinicTransparencyProgressPanelProps = {
  profile: ClinicTransparencyProfile | null;
  /** Human-readable next milestone (from getNextMilestoneFromProfile). */
  nextMilestone: string | null;
  /** Next tier label, e.g. "SILVER" (from getNextTier). */
  nextTierLabel: string | null;
  /** Section title (default: "Clinic Transparency Progress"). */
  title?: string;
};

function MetricCard({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200/80 bg-white/80 p-3 ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
      {sub != null && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function ClinicTransparencyProgressPanel({
  profile,
  nextMilestone,
  nextTierLabel,
  title = "Clinic Transparency Progress",
}: ClinicTransparencyProgressPanelProps) {
  const p = profile ?? ({} as ClinicTransparencyProfile);
  const audited = Number(p.audited_case_count ?? 0);
  const contributed = Number(p.contributed_case_count ?? 0);
  const validated = Number(p.validated_case_count ?? p.contributed_case_count ?? 0);
  const benchmarkValidated = Number(p.benchmark_eligible_validated_count ?? p.benchmark_eligible_count ?? 0);
  const participationRate = Number(p.transparency_score ?? 0);
  const currentTier = (p.current_award_tier ?? "VERIFIED") as AwardTier;
  const isPaused = Boolean(p.award_progression_paused);

  // Transparency Impact — real metrics
  const contributionRate = audited > 0 ? (contributed / audited) * 100 : 0;
  const benchmarkReadyPct = validated > 0 ? (benchmarkValidated / validated) * 100 : 0;
  const casesWithDoctorInputPct = audited > 0 ? (contributed / audited) * 100 : 0;
  // Scaffold: confidence uplift from clinic documentation (not yet available)
  const confidenceUpliftAvailable = false;
  const confidenceUpliftLabel = "Confidence uplift from clinic documentation";
  const confidenceUpliftValue = confidenceUpliftAvailable ? "—" : "—";

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200/80 bg-slate-50/60 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          {title}
        </h2>
      </div>

      {/* Current tier + next tier + paused — prominent */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-4">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-slate-500">Current tier</span>
          <span
            className={`rounded-lg px-3 py-1.5 text-lg font-bold ${
              currentTier === "PLATINUM"
                ? "bg-amber-100 text-amber-900"
                : currentTier === "GOLD"
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : currentTier === "SILVER"
                    ? "bg-slate-100 text-slate-800 border border-slate-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
            }`}
          >
            {currentTier}
          </span>
        </div>
        {nextTierLabel && (
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-slate-500">Next tier</span>
            <span className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-600">
              {nextTierLabel}
            </span>
          </div>
        )}
        {isPaused && (
          <span className="rounded bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
            Progression paused
          </span>
        )}
      </div>

      {/* Display metrics — compact grid */}
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard label="Participation rate" value={`${participationRate.toFixed(0)}%`} />
        <MetricCard label="Total audited cases" value={audited} />
        <MetricCard label="Doctor-contributed cases" value={contributed} />
        <MetricCard label="Validated award-counting" value={validated} />
        <MetricCard
          label="Provisional (awaiting validation)"
          value={Number(p.provisional_high_score_count ?? 0)}
          sub="High-score cases not yet counting"
        />
        <MetricCard label="Benchmark-eligible validated" value={benchmarkValidated} />
        <MetricCard
          label="Avg validated forensic score"
          value={Number(p.average_forensic_score ?? 0).toFixed(1)}
        />
        <MetricCard
          label="Documentation integrity avg"
          value={Number(p.documentation_integrity_average ?? 0).toFixed(1)}
        />
      </div>

      {/* Next Milestone — prominent */}
      <div className="border-t border-slate-200/80 bg-emerald-50/50 px-4 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Next milestone
        </h3>
        {nextMilestone ? (
          <p className="mt-2 text-sm font-medium text-emerald-900">{nextMilestone}</p>
        ) : (
          <p className="mt-2 text-sm text-emerald-800">
            You’ve reached the highest tier (PLATINUM). Keep maintaining your standards.
          </p>
        )}
      </div>

      {/* Transparency Impact */}
      <div className="border-t border-slate-200/80 px-4 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Transparency impact
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Contribution rate"
            value={`${contributionRate.toFixed(0)}%`}
            sub="Invited cases with doctor contribution"
          />
          <MetricCard
            label="Benchmark-ready uplift"
            value={validated > 0 ? `${benchmarkReadyPct.toFixed(0)}%` : "—"}
            sub="Validated cases that are benchmark-eligible"
          />
          <MetricCard
            label={confidenceUpliftLabel}
            value={confidenceUpliftValue}
            sub={confidenceUpliftAvailable ? undefined : undefined}
          />
          <MetricCard
            label="Cases with doctor input"
            value={`${casesWithDoctorInputPct.toFixed(0)}%`}
            sub="Fairly completed with doctor contribution"
          />
        </div>
      </div>
    </section>
  );
}
