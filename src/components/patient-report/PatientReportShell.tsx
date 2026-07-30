"use client";

import { useMemo } from "react";
import type { PatientReportViewModel } from "@/lib/patientReport/types";
import type { PatientReportAnalyticsContext } from "@/lib/patientReport/analytics";
import PatientReportHeader from "@/components/patient-report/PatientReportHeader";
import PatientReportSummary from "@/components/patient-report/PatientReportSummary";
import PatientReportStatusStrip from "@/components/patient-report/PatientReportStatusStrip";
import PatientReportWhatThisMeans from "@/components/patient-report/PatientReportWhatThisMeans";
import PatientReportPhotoGallery from "@/components/patient-report/PatientReportPhotoGallery";
import PatientReportFindings from "@/components/patient-report/PatientReportFindings";
import PatientReportTimeline from "@/components/patient-report/PatientReportTimeline";
import PatientReportLimitations from "@/components/patient-report/PatientReportLimitations";
import PatientReportNextSteps from "@/components/patient-report/PatientReportNextSteps";
import PatientReportDisclosure from "@/components/patient-report/PatientReportDisclosure";
import PatientReportNavigation from "@/components/patient-report/PatientReportNavigation";
import { PatientReportSectionFrame } from "@/components/patient-report/PatientReportSection";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Canonical patient-facing report shell.
 * Renders configured sections only — no professional controls.
 */
export default function PatientReportShell({
  model,
  uploads = [],
  caseId,
}: {
  model: PatientReportViewModel;
  uploads?: UploadRow[];
  caseId?: string;
}) {
  const analytics: PatientReportAnalyticsContext = model.analytics;

  const navItems = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    const seen = new Set<string>();
    for (const section of model.sections) {
      if (seen.has(section.navLabel)) continue;
      seen.add(section.navLabel);
      items.push({ id: section.id, label: section.navLabel });
    }
    return items;
  }, [model.sections]);

  const alwaysVisible = model.disclosures.filter((d) => d.alwaysVisible);

  return (
    <article
      data-testid="patient-report-shell"
      data-report-type={model.reportType}
      className="patient-report-shell mx-auto mt-6 max-w-6xl overflow-x-hidden rounded-2xl border border-slate-200 bg-[#f7f8fa] text-slate-900 shadow-sm print:max-w-none print:border-0 print:bg-white print:shadow-none"
    >
      <PatientReportHeader model={model} analytics={analytics} />
      <PatientReportNavigation items={navItems} />

      <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <PatientReportSectionFrame id="orientation" wide>
          <div className="mx-auto max-w-4xl space-y-4">
            <PatientReportSummary summary={model.summary} />
            <PatientReportStatusStrip items={model.statusItems} />
          </div>
        </PatientReportSectionFrame>

        {alwaysVisible.length > 0 ? (
          <PatientReportDisclosure alwaysVisibleItems={alwaysVisible} analytics={analytics} />
        ) : null}

        {model.sections.map((section) => {
          switch (section.type) {
            case "orientation":
              return null;
            case "narrative":
              return <PatientReportWhatThisMeans key={section.id} section={section} />;
            case "photos":
              return (
                <PatientReportPhotoGallery
                  key={section.id}
                  section={section}
                  uploads={uploads}
                  caseId={caseId}
                  analytics={analytics}
                />
              );
            case "findings":
              return <PatientReportFindings key={section.id} section={section} />;
            case "timeline":
              return <PatientReportTimeline key={section.id} section={section} />;
            case "limitations":
              return <PatientReportLimitations key={section.id} section={section} />;
            case "recommendations":
              return (
                <PatientReportNextSteps
                  key={section.id}
                  section={section}
                  analytics={analytics}
                />
              );
            case "disclosure":
              return (
                <PatientReportDisclosure
                  key={section.id}
                  section={section}
                  analytics={analytics}
                />
              );
            case "comparison":
              return (
                <PatientReportSectionFrame
                  key={section.id}
                  id={section.id}
                  title={section.title}
                >
                  <p className="text-sm leading-relaxed text-slate-700">{section.body}</p>
                </PatientReportSectionFrame>
              );
            default:
              return null;
          }
        })}
      </div>
    </article>
  );
}
