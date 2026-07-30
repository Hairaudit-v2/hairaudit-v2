"use client";

import { useId, useState } from "react";
import type {
  PatientReportDisclosureItem,
  PatientReportDisclosureSection,
} from "@/lib/patientReport/types";
import type { PatientReportAnalyticsContext } from "@/lib/patientReport/analytics";
import { trackPatientReportUiEvent } from "@/lib/patientReport/analytics";
import { PatientReportSectionFrame } from "@/components/patient-report/PatientReportSection";

function DisclosureItem({
  item,
  analytics,
  forceOpen,
}: {
  item: PatientReportDisclosureItem;
  analytics: PatientReportAnalyticsContext;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isOpen = forceOpen || open;

  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <h4>
        <button
          type="button"
          className="patient-report-disclosure-trigger flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) {
              trackPatientReportUiEvent("patient_report_section_opened", analytics, {
                section_type: "disclosure",
                disclosure_id: item.id,
              });
            }
          }}
        >
          <span>{item.title}</span>
          <span className="text-slate-400" aria-hidden>
            {isOpen ? "−" : "+"}
          </span>
        </button>
      </h4>
      <div
        id={panelId}
        role="region"
        hidden={!isOpen}
        className={`patient-report-disclosure-panel px-4 pb-4 text-sm leading-relaxed text-slate-700 ${
          item.expandInPrint ? "patient-report-print-open" : ""
        }`}
      >
        {isOpen ? item.body : null}
        {/* Print: always include expandInPrint bodies via CSS class companion */}
        {item.expandInPrint && !isOpen ? (
          <span className="hidden patient-report-print-only">{item.body}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function PatientReportDisclosure({
  section,
  analytics,
  alwaysVisibleItems = [],
}: {
  section?: PatientReportDisclosureSection;
  analytics: PatientReportAnalyticsContext;
  alwaysVisibleItems?: PatientReportDisclosureItem[];
}) {
  if (!section && alwaysVisibleItems.length === 0) return null;

  return (
    <>
      {alwaysVisibleItems.map((item) => (
        <div
          key={item.id}
          data-testid={`patient-report-always-visible-${item.id}`}
          className="mx-auto max-w-4xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
          role="note"
        >
          <p className="font-semibold">{item.title}</p>
          <p className="mt-1">{item.body}</p>
        </div>
      ))}

      {section ? (
        <PatientReportSectionFrame
          id={section.id}
          title={section.title}
          subtitle={section.subtitle}
        >
          <div
            data-testid={`patient-report-disclosure-${section.id}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            {section.items.map((item) => (
              <DisclosureItem key={item.id} item={item} analytics={analytics} />
            ))}
          </div>
        </PatientReportSectionFrame>
      ) : null}
    </>
  );
}
