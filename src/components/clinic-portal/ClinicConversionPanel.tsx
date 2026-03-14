import Link from "next/link";

type ConversionAction = {
  label: string;
  href: string;
};

type ReadinessState = {
  label: string;
  ready: boolean;
};

export default function ClinicConversionPanel({
  title = "Trust and Completion Accelerator",
  subtitle = "Finish core setup to strengthen patient confidence, raise internal quality control, and prepare for verified visibility.",
  nextActions,
  readinessStates,
  teaserHref = "/dashboard/clinic/profile",
  teaserCtaLabel = "Preview profile impact",
  compact = true,
}: {
  title?: string;
  subtitle?: string;
  nextActions: ConversionAction[];
  readinessStates: ReadinessState[];
  teaserHref?: string;
  teaserCtaLabel?: string;
  compact?: boolean;
}) {
  const readyCount = readinessStates.filter((state) => state.ready).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Conversion Layer</p>
      <h3 className="mt-1 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {readyCount}/{readinessStates.length} readiness signals active
        </span>
        <Link
          href={teaserHref}
          className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
        >
          {teaserCtaLabel}
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {nextActions.slice(0, compact ? 3 : nextActions.length).map((action) => (
          <Link
            key={`${action.label}-${action.href}`}
            href={action.href}
            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
          >
            {action.label}
          </Link>
        ))}
      </div>

      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">
          Show readiness details
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {readinessStates.map((state) => (
            <span
              key={state.label}
              className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                state.ready
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {state.label}
            </span>
          ))}
        </div>
      </details>
    </section>
  );
}
