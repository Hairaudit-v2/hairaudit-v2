"use client";

import type { PatientReportFindingsSection } from "@/lib/patientReport/types";
import { PatientReportSectionFrame } from "@/components/patient-report/PatientReportSection";

const STRENGTH_LABEL = {
  high: "High",
  moderate: "Moderate",
  limited: "Limited",
} as const;

const STRENGTH_CLASS = {
  high: "bg-emerald-100 text-emerald-900",
  moderate: "bg-amber-100 text-amber-900",
  limited: "bg-slate-200 text-slate-700",
} as const;

export default function PatientReportFindings({
  section,
}: {
  section: PatientReportFindingsSection;
}) {
  return (
    <PatientReportSectionFrame
      id={section.id}
      title={section.title}
      subtitle={section.subtitle}
    >
      <div
        data-testid="patient-report-findings"
        className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block"
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Domain</th>
              <th className="px-4 py-3 font-semibold">Observation</th>
              <th className="px-4 py-3 font-semibold">Evidence strength</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.domain} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3 font-medium text-slate-900">{row.domain}</td>
                <td className="px-4 py-3 leading-relaxed text-slate-700">
                  {row.observation}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${STRENGTH_CLASS[row.evidenceStrength]}`}
                  >
                    {STRENGTH_LABEL[row.evidenceStrength]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {section.rows.map((row) => (
          <li
            key={`m-${row.domain}`}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-sm font-semibold text-slate-900">{row.domain}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{row.observation}</p>
            <p className="mt-2 text-xs text-slate-500">
              Evidence strength:{" "}
              <span className="font-semibold text-slate-700">
                {STRENGTH_LABEL[row.evidenceStrength]}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </PatientReportSectionFrame>
  );
}
