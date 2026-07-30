"use client";

import type { ReactNode } from "react";
import type { PatientReportSemanticTone } from "@/lib/patientReport/types";

const TONE_SURFACE: Record<PatientReportSemanticTone, string> = {
  compatible: "border-emerald-200 bg-emerald-50 text-emerald-950",
  uncertain: "border-amber-200 bg-amber-50 text-amber-950",
  clinical: "border-rose-200 bg-rose-50 text-rose-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
  unavailable: "border-slate-200 bg-slate-100 text-slate-800",
};

const TONE_DOT: Record<PatientReportSemanticTone, string> = {
  compatible: "bg-emerald-500",
  uncertain: "bg-amber-500",
  clinical: "bg-rose-500",
  info: "bg-sky-500",
  unavailable: "bg-slate-400",
};

export function patientReportToneSurface(tone: PatientReportSemanticTone = "info"): string {
  return TONE_SURFACE[tone];
}

export function patientReportToneDot(tone: PatientReportSemanticTone = "info"): string {
  return TONE_DOT[tone];
}

export function PatientReportSectionFrame({
  id,
  title,
  subtitle,
  children,
  wide = false,
  className = "",
}: {
  id: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <section
      id={`patient-report-${id}`}
      data-patient-report-section={id}
      className={`scroll-mt-24 ${wide ? "w-full" : "mx-auto max-w-4xl"} ${className}`}
    >
      {title ? (
        <header className="mb-3">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{subtitle}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
