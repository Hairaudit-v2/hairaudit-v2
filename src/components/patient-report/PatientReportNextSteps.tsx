"use client";

import type { PatientReportRecommendationsSection } from "@/lib/patientReport/types";
import type { PatientReportAnalyticsContext } from "@/lib/patientReport/analytics";
import { trackPatientReportUiEvent } from "@/lib/patientReport/analytics";
import { PatientReportSectionFrame } from "@/components/patient-report/PatientReportSection";

export default function PatientReportNextSteps({
  section,
  analytics,
}: {
  section: PatientReportRecommendationsSection;
  analytics: PatientReportAnalyticsContext;
}) {
  return (
    <PatientReportSectionFrame
      id={section.id}
      title={section.title}
      subtitle={section.subtitle}
    >
      <ul
        data-testid="patient-report-next-steps"
        className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5"
      >
        {section.steps.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              className="flex w-full gap-3 rounded-lg px-1 py-1 text-left text-sm leading-relaxed text-emerald-950 hover:bg-emerald-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              onClick={() =>
                trackPatientReportUiEvent("patient_report_next_step_clicked", analytics, {
                  section_type: "recommendations",
                  next_step_key: step.analyticsKey ?? step.id,
                })
              }
            >
              <span className="mt-0.5 font-bold text-emerald-700" aria-hidden>
                ✓
              </span>
              <span>{step.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </PatientReportSectionFrame>
  );
}
