"use client";

import type { PatientReportLimitationsSection } from "@/lib/patientReport/types";
import { PatientReportSectionFrame } from "@/components/patient-report/PatientReportSection";

export default function PatientReportLimitations({
  section,
}: {
  section: PatientReportLimitationsSection;
}) {
  return (
    <PatientReportSectionFrame id={section.id} title={section.title}>
      <div
        data-testid="patient-report-limitations"
        className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4"
      >
        <ul className="space-y-2 text-sm leading-relaxed text-slate-600">
          {section.items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </PatientReportSectionFrame>
  );
}
