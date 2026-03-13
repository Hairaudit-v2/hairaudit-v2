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
}: {
  title?: string;
  subtitle?: string;
  nextActions: ConversionAction[];
  readinessStates: ReadinessState[];
  teaserHref?: string;
  teaserCtaLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Conversion Layer</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next best actions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {nextActions.map((action) => (
                <Link
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
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
        </div>

        <aside className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Public Profile Teaser</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            Fuller clinic profiles improve trust, discoverability, and commercial conversion confidence.
          </p>
          <p className="mt-1 text-xs text-slate-700">
            Complete identity, methods, devices, and evidence posture to move toward verified public credibility.
          </p>
          <Link
            href={teaserHref}
            className="mt-3 inline-flex rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-semibold text-cyan-900 hover:bg-cyan-50"
          >
            {teaserCtaLabel}
          </Link>
        </aside>
      </div>
    </section>
  );
}
