"use client";

import { useCallback, useEffect, useState } from "react";
import type { PatientReportPhoto, PatientReportPhotoSection } from "@/lib/patientReport/types";
import type { PatientReportAnalyticsContext } from "@/lib/patientReport/analytics";
import { trackPatientReportUiEvent } from "@/lib/patientReport/analytics";
import { PatientReportSectionFrame } from "@/components/patient-report/PatientReportSection";
import { uploadSignedUrlFetchPath } from "@/lib/uploads/uploadSignedUrlClient";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: Record<string, unknown> | null;
};

export default function PatientReportPhotoGallery({
  section,
  uploads = [],
  caseId,
  analytics,
}: {
  section: PatientReportPhotoSection;
  uploads?: UploadRow[];
  caseId?: string;
  analytics: PatientReportAnalyticsContext;
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [expanded, setExpanded] = useState<PatientReportPhoto | null>(null);

  useEffect(() => {
    if (!caseId || uploads.length === 0) return;
    let active = true;

    async function load() {
      const keys = section.groups.flatMap((g) =>
        g.photos.map((p) => p.fetchKey).filter((k): k is string => Boolean(k))
      );
      const unique = [...new Set(keys)];
      const entries = await Promise.all(
        unique.map(async (key) => {
          const upload = uploads.find((u) => u.id === key);
          if (!upload?.storage_path) return [key, null] as const;
          try {
            const res = await fetch(uploadSignedUrlFetchPath(upload.storage_path, caseId));
            const json = await res.json().catch(() => ({}));
            return [key, (json?.url as string | null) ?? null] as const;
          } catch {
            return [key, null] as const;
          }
        })
      );
      if (!active) return;
      setUrls(Object.fromEntries(entries));
    }

    void load();
    return () => {
      active = false;
    };
  }, [caseId, section.groups, uploads]);

  const close = useCallback(() => setExpanded(null), []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, close]);

  if (section.groups.length === 0) {
    return (
      <PatientReportSectionFrame id={section.id} title={section.title} subtitle={section.subtitle} wide>
        <p className="text-sm text-slate-600" data-testid="patient-report-photo-empty">
          No photographs were available for this report.
        </p>
      </PatientReportSectionFrame>
    );
  }

  return (
    <PatientReportSectionFrame
      id={section.id}
      title={section.title}
      subtitle={section.subtitle}
      wide
    >
      <div data-testid="patient-report-photo-gallery" className="space-y-6">
        {section.groups.map((group) => (
          <div key={group.id}>
            <h4 className="text-sm font-semibold text-slate-800">{group.title}</h4>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.photos.map((photo, idx) => {
                const src =
                  photo.imageUrl ??
                  (photo.fetchKey ? urls[photo.fetchKey] : null) ??
                  null;
                return (
                  <button
                    key={`${group.id}-${idx}-${photo.label}`}
                    type="button"
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    onClick={() => {
                      setExpanded(photo);
                      trackPatientReportUiEvent("patient_report_photo_expanded", analytics, {
                        section_type: "photos",
                        photo_role: photo.role,
                      });
                    }}
                    aria-label={`Expand ${photo.label}`}
                  >
                    <div className="aspect-[4/3] bg-slate-200">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={photo.alt}
                          className="h-full w-full object-contain bg-slate-100 transition group-hover:opacity-95"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">
                          Photo unavailable
                        </div>
                      )}
                    </div>
                    <div className="bg-white px-3 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {photo.label}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        {photo.dateLabel ? <span>{photo.dateLabel}</span> : null}
                        {photo.evidenceQualityLabel ? (
                          <span>{photo.evidenceQualityLabel}</span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {expanded ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={expanded.label}
          data-testid="patient-report-photo-lightbox"
          className="patient-report-no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={close}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
              <p className="text-sm font-semibold text-slate-900">{expanded.label}</p>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
                onClick={close}
              >
                Close
              </button>
            </div>
            <div className="flex min-h-[40vh] items-center justify-center bg-slate-100">
              {(() => {
                const src =
                  expanded.imageUrl ??
                  (expanded.fetchKey ? urls[expanded.fetchKey] : null) ??
                  null;
                return src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={expanded.alt}
                    className="max-h-[75vh] w-auto max-w-full object-contain"
                  />
                ) : (
                  <p className="text-sm text-slate-500">Photo unavailable</p>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </PatientReportSectionFrame>
  );
}
