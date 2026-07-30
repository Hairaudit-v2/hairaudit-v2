"use client";

import type { PatientReportNarrativeSection } from "@/lib/patientReport/types";
import { PatientReportSectionFrame } from "@/components/patient-report/PatientReportSection";

export default function PatientReportWhatThisMeans({
  section,
}: {
  section: PatientReportNarrativeSection;
}) {
  const { whatThisMeans } = section;
  return (
    <PatientReportSectionFrame id={section.id} title={section.title}>
      <div
        data-testid="patient-report-what-this-means"
        className="grid gap-4 lg:grid-cols-3"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">
            What the photographs support
          </h4>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
            {whatThisMeans.photographsSupport.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">What remains uncertain</h4>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
            {whatThisMeans.remainsUncertain.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <h4 className="text-sm font-semibold text-sky-950">Recommended next step</h4>
          <p className="mt-2 text-sm leading-relaxed text-sky-950">
            {whatThisMeans.recommendedNextStep}
          </p>
        </div>
      </div>
    </PatientReportSectionFrame>
  );
}
