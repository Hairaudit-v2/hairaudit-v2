"use client";

import type { PatientReportSummary } from "@/lib/patientReport/types";
import {
  patientReportToneDot,
  patientReportToneSurface,
} from "@/components/patient-report/PatientReportSection";

export default function PatientReportSummary({
  summary,
}: {
  summary: PatientReportSummary;
}) {
  return (
    <div
      data-testid="patient-report-summary"
      className={`rounded-2xl border px-5 py-5 sm:px-6 sm:py-6 ${patientReportToneSurface(summary.tone)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${patientReportToneDot(summary.tone)}`}
          aria-hidden
        />
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
          {summary.label}
        </p>
        {summary.reviewStatusLabel ? (
          <span className="rounded-md border border-current/20 bg-white/50 px-2 py-0.5 text-[11px] font-medium">
            {summary.reviewStatusLabel}
          </span>
        ) : null}
      </div>
      <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
        {summary.title}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed opacity-90 sm:text-base">
        {summary.narrative}
      </p>
      {summary.escalationCopy ? (
        <div
          data-testid="patient-report-escalation"
          role="status"
          className="mt-4 rounded-xl border border-rose-300 bg-white/80 px-4 py-3 text-sm leading-relaxed text-rose-950"
        >
          {summary.escalationCopy}
        </div>
      ) : null}
    </div>
  );
}
