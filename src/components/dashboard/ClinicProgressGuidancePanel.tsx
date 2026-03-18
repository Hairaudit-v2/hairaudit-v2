import Link from "next/link";
import type { ClinicProgressStep } from "@/lib/clinicPortal";

type Props = {
  steps: ClinicProgressStep[];
  title?: string;
  subtitle?: string;
};

/**
 * Renders a list of next-step actions for clinic progress.
 * Steps are derived from real product state (see buildClinicProgressSteps).
 */
export default function ClinicProgressGuidancePanel({
  steps,
  title = "Your next steps",
  subtitle = "Actions that improve profile completeness, benchmarking readiness, and public visibility.",
}: Props) {
  if (steps.length === 0) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Progress
        </p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <p className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-800">
          You’re in good shape. Keep submitting cases and responding to Invited Contributions to strengthen your visibility.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
        Progress
      </p>
      <h3 className="mt-1 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-800">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={step.href}
                className="font-medium text-slate-900 hover:text-cyan-700 hover:underline"
              >
                {step.message}
              </Link>
              <p className="mt-0.5 text-xs text-slate-500">{step.detail}</p>
            </div>
            <Link
              href={step.href}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Go →
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
