import Link from "next/link";

type CaseNotFoundRecoveryProps = {
  /** Where a generic dashboard link should point (role-aware if available). */
  dashboardHref: string;
  /**
   * Safe route for "Start new assessment" — must NOT trigger case create.
   * Should be dashboard so user can start a new audit from there. Defaults to dashboardHref.
   */
  startNewHref?: string;
  /** Whether to show the optional "View your existing cases" affordance. */
  showExistingCasesLink?: boolean;
  /** Href for the "View your existing cases" link. Defaults to dashboardHref. */
  existingCasesHref?: string;
};

export default function CaseNotFoundRecovery({
  dashboardHref,
  startNewHref,
  showExistingCasesLink,
  existingCasesHref,
}: CaseNotFoundRecoveryProps) {
  // Both actions go to safe routes only; never trigger create from this page.
  const safeStartHref = startNewHref ?? dashboardHref;
  const existingHref = existingCasesHref ?? dashboardHref;

  return (
    <div className="mx-auto mt-8 max-w-xl px-4 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative space-y-4 text-center">
            <div className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              No case found
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">No case found</h1>
              <p className="mt-2 text-sm text-slate-300/85 sm:text-base">
                We couldn&apos;t find a case linked to this page. The assessment may not have been created successfully. Return to your dashboard and try starting a new audit from there.
              </p>
            </div>

            <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href={safeStartHref}
                className="inline-flex items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-300/20 px-4 py-2.5 text-sm font-semibold text-cyan-50 shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-300/30"
              >
                Go to dashboard
              </Link>
              {showExistingCasesLink && (
                <Link
                  href={existingHref}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-600/70 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-slate-800/80"
                >
                  View your existing cases
                </Link>
              )}
            </div>

            {showExistingCasesLink && (
              <div className="pt-2 text-xs text-slate-400">
                Or{" "}
                <Link
                  href={existingHref}
                  className="font-medium text-amber-300 underline-offset-2 hover:text-amber-200 hover:underline"
                >
                  view your existing cases
                </Link>
                .
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

