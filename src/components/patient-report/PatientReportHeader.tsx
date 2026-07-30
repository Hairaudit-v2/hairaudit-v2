"use client";

import type { PatientReportAction, PatientReportViewModel } from "@/lib/patientReport/types";
import type { PatientReportAnalyticsContext } from "@/lib/patientReport/analytics";
import PatientReportPrintActions from "@/components/patient-report/PatientReportPrintActions";

export default function PatientReportHeader({
  model,
  analytics,
}: {
  model: PatientReportViewModel;
  analytics: PatientReportAnalyticsContext;
}) {
  const back = model.actions.find((a) => a.kind === "back");
  const download = model.actions.find((a) => a.kind === "download");
  const printAction = model.actions.find((a) => a.kind === "print");

  return (
    <header
      data-testid="patient-report-header"
      className="border-b border-slate-200/80 bg-white px-4 py-5 sm:px-6 lg:px-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            HairAudit
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {model.reportType === "donor_healing"
              ? "Post-Surgery Audit · Donor healing"
              : model.reportSubtitle ?? model.reportType.replaceAll("_", " ")}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {model.reportTitle}
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {model.reportDate ? (
              <span>
                <span className="text-slate-400">Report date </span>
                {formatDate(model.reportDate)}
              </span>
            ) : null}
            {model.procedureDate ? (
              <span>
                <span className="text-slate-400">Procedure date </span>
                {formatDate(model.procedureDate)}
              </span>
            ) : null}
            {model.caseStatus ? (
              <span>
                <span className="text-slate-400">Status </span>
                {model.caseStatus}
              </span>
            ) : null}
            {model.reportReference ? (
              <span>
                <span className="text-slate-400">Reference </span>
                {model.reportReference}
              </span>
            ) : null}
          </div>
        </div>

        <PatientReportPrintActions
          back={back}
          download={download}
          printAction={printAction}
          analytics={analytics}
        />
      </div>
    </header>
  );
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type { PatientReportAction };
