"use client";

import type { PatientReportAction } from "@/lib/patientReport/types";
import type { PatientReportAnalyticsContext } from "@/lib/patientReport/analytics";
import { trackPatientReportUiEvent } from "@/lib/patientReport/analytics";

export default function PatientReportPrintActions({
  back,
  download,
  printAction,
  analytics,
}: {
  back?: PatientReportAction;
  download?: PatientReportAction;
  printAction?: PatientReportAction;
  analytics: PatientReportAnalyticsContext;
}) {
  return (
    <div
      data-testid="patient-report-print-actions"
      className="patient-report-no-print flex flex-wrap items-center gap-2"
    >
      {back?.href ? (
        <a
          href={back.href}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {back.label}
        </a>
      ) : null}
      {download?.href ? (
        <a
          href={download.href}
          className="inline-flex items-center rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() =>
            trackPatientReportUiEvent("patient_report_download_clicked", analytics, {
              section_type: "header",
            })
          }
        >
          {download.label}
        </a>
      ) : null}
      {printAction ? (
        <button
          type="button"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => {
            trackPatientReportUiEvent("patient_report_print_clicked", analytics, {
              section_type: "header",
            });
            window.print();
          }}
        >
          {printAction.label}
        </button>
      ) : null}
    </div>
  );
}
