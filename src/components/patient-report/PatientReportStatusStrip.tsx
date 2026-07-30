"use client";

import type { PatientReportStatusItem } from "@/lib/patientReport/types";
import {
  patientReportToneDot,
  patientReportToneSurface,
} from "@/components/patient-report/PatientReportSection";

export default function PatientReportStatusStrip({
  items,
}: {
  items: PatientReportStatusItem[];
}) {
  if (!items.length) return null;

  return (
    <ul
      data-testid="patient-report-status-strip"
      className="grid gap-3 sm:grid-cols-3"
      aria-label="Report status indicators"
    >
      {items.map((item) => (
        <li
          key={item.id}
          className={`rounded-xl border px-4 py-3 ${patientReportToneSurface(item.tone ?? "info")}`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${patientReportToneDot(item.tone ?? "info")}`}
              aria-hidden
            />
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
              {item.label}
            </p>
          </div>
          <p className="mt-1.5 text-sm font-medium leading-snug">{item.value}</p>
        </li>
      ))}
    </ul>
  );
}
