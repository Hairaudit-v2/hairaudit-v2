"use client";

import type { PatientReportTimelineSection } from "@/lib/patientReport/types";
import { PatientReportSectionFrame } from "@/components/patient-report/PatientReportSection";

export default function PatientReportTimeline({
  section,
}: {
  section: PatientReportTimelineSection;
}) {
  return (
    <PatientReportSectionFrame
      id={section.id}
      title={section.title}
      subtitle={section.subtitle}
    >
      <ol
        data-testid="patient-report-timeline"
        className="space-y-3 border-l-2 border-slate-200 pl-4"
      >
        {section.items.map((item) => (
          <li key={item.id} className="relative">
            <span
              className={`absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full ${
                item.emphasis ? "bg-slate-900" : "bg-slate-400"
              }`}
              aria-hidden
            />
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.body}</p>
          </li>
        ))}
      </ol>
    </PatientReportSectionFrame>
  );
}
