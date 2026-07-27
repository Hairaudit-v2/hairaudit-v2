"use client";

import Link from "next/link";
import type { GuidedCaptureLandingDto } from "@/lib/outcomeIntelligence/guidedCaptureDto";
import { formatTargetDateForPatient } from "@/lib/outcomeIntelligence/guidedCaptureWizard";

export default function LongitudinalCaptureLanding({
  caseId,
  landing,
  homeHref = "/",
}: {
  caseId: string;
  landing: GuidedCaptureLandingDto;
  homeHref?: string;
}) {
  return (
    <div
      className="mx-auto min-h-[100dvh] max-w-lg px-4 py-5 pb-10"
      data-testid="longitudinal-capture-landing"
    >
      <Link
        href={homeHref}
        className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        ← Home
      </Link>

      <header className="mt-4 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Your HairAudit follow-ups
        </h1>
        <p className="text-sm text-slate-600">
          Capture consistent photos at each stage so HairAudit can document how your
          transplant looks over time.
        </p>
      </header>

      <ol className="mt-6 space-y-3" data-testid="longitudinal-capture-timeline">
        <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Surgery Day</p>
          <p className="text-sm text-slate-600">
            Projection created
            {landing.procedureDate
              ? ` · ${formatTargetDateForPatient(landing.procedureDate)}`
              : ""}
          </p>
        </li>
        {landing.milestones.map((m) => (
          <li key={m.stage}>
            {m.href ? (
              <Link
                href={m.href}
                className="block rounded-xl border border-slate-200 bg-white px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                data-testid={`longitudinal-milestone-${m.stage}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{m.label}</p>
                    <p className="text-sm text-slate-600">
                      Target {formatTargetDateForPatient(m.targetDate)}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Required {m.progress.requiredComplete}/{m.progress.requiredTotal}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
                    <span aria-hidden="true">
                      {m.status === "observed" || m.status === "ready_for_review"
                        ? "✓"
                        : m.status === "due" || m.status === "evidence_incomplete"
                          ? "→"
                          : "○"}
                    </span>
                    {m.statusLabel}
                  </span>
                </div>
              </Link>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="font-semibold text-slate-900">{m.label}</p>
                <p className="text-sm text-slate-600">{m.statusLabel}</p>
              </div>
            )}
          </li>
        ))}
      </ol>

      <p className="sr-only">Case {caseId}</p>
    </div>
  );
}
