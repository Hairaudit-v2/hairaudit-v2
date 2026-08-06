"use client";

/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Patient web Illustrative Projected Result.
 * Auditor correction markup is never shown here.
 */

import { useEffect, useState } from "react";
import type { IllustrativeProjectedResultSection } from "@/lib/preSurgeryIntelligence/reportProjectionInclusion";
import { PROJECTION_ASSET_FALLBACK_NOTICE } from "@/lib/preSurgeryIntelligence/reportProjectionCopy";
import { uploadSignedUrlFetchPath } from "@/lib/uploads/uploadSignedUrlClient";

type ViewMode = "side_by_side" | "original" | "projected";

export default function IllustrativeProjectedResultSection({
  section,
  caseId,
}: {
  section: IllustrativeProjectedResultSection | null | undefined;
  caseId?: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("side_by_side");
  const [zoom, setZoom] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [projectedUrl, setProjectedUrl] = useState<string | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);

  useEffect(() => {
    if (!section?.showImagery || !caseId || !section.projectionSnapshotId) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/cases/${caseId}/pre-surgery-intelligence/projection/report-media?projectionId=${encodeURIComponent(
            section!.projectionSnapshotId!
          )}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          if (!cancelled) setMediaFailed(true);
          return;
        }
        const data = (await res.json()) as {
          sourceStoragePath?: string | null;
          projectedStoragePath?: string | null;
        };

        async function sign(path: string | null | undefined): Promise<string | null> {
          if (!path) return null;
          const r = await fetch(uploadSignedUrlFetchPath(path, caseId), {
            credentials: "include",
          });
          if (!r.ok) return null;
          const j = (await r.json()) as { signedUrl?: string };
          return j.signedUrl ?? null;
        }

        const [src, proj] = await Promise.all([
          sign(data.sourceStoragePath),
          sign(data.projectedStoragePath),
        ]);
        if (cancelled) return;
        setSourceUrl(src);
        setProjectedUrl(proj);
        if (!src && !proj) setMediaFailed(true);
      } catch {
        if (!cancelled) setMediaFailed(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [section, caseId]);

  if (!section) return null;

  if (!section.showImagery || section.inclusionState !== "approved_for_inclusion") {
    if (!section.omitExplanation) return null;
    return (
      <section
        data-testid="illustrative-projected-result"
        data-inclusion={section.inclusionState}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.omitExplanation}</p>
      </section>
    );
  }

  const graft =
    section.provisionalGraftRange != null
      ? `${section.provisionalGraftRange.min}–${section.provisionalGraftRange.max} grafts (provisional)`
      : null;

  function renderImage(url: string | null, alt: string, caption: string) {
    return (
      <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={alt}
            className={`w-full bg-slate-200 object-contain object-center ${
              zoom ? "max-h-[520px]" : "max-h-[280px]"
            }`}
          />
        ) : (
          <div className="flex h-[200px] items-center justify-center px-4 text-center text-xs text-slate-500">
            {mediaFailed ? PROJECTION_ASSET_FALLBACK_NOTICE : "Loading planning image…"}
          </div>
        )}
        <figcaption className="border-t border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {caption}
        </figcaption>
      </figure>
    );
  }

  return (
    <section
      data-testid="illustrative-projected-result"
      data-inclusion="approved_for_inclusion"
      className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{section.intro}</p>

      <div
        role="note"
        className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-950"
      >
        {section.limitationPanel}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["side_by_side", "Side by side"],
            ["original", "Original"],
            ["projected", "Projected"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setViewMode(id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              viewMode === id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setZoom((z) => !z)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {zoom ? "Fit view" : "Zoom"}
        </button>
      </div>

      <div
        className={`mt-4 grid gap-3 ${
          viewMode === "side_by_side" ? "sm:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {(viewMode === "side_by_side" || viewMode === "original") &&
          renderImage(sourceUrl, "Original planning photograph", "Submitted source")}
        {(viewMode === "side_by_side" || viewMode === "projected") &&
          renderImage(projectedUrl, "Illustrative planning projection", "Illustrative projection")}
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Planning mode
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-900">
            {section.planningModeLabel ?? section.patientSafeLabel}
          </dd>
        </div>
        {graft ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Provisional graft range
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{graft}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Snapshot
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-900">
            {section.snapshotVersionLabel}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Approval
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-900">
            {[section.approvalDate?.slice(0, 10), section.reviewerAttribution]
              .filter(Boolean)
              .join(" · ") || "Clinician approved"}
          </dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Modelled treatment zones
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {section.modelledTreatmentZones
              .filter((z) => z.priority !== "defer")
              .map((z) => (
                <li key={z.zone}>
                  {z.zone}
                  {z.grafts != null ? ` — ${z.grafts} grafts` : ""}
                </li>
              ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Deferred or excluded zones
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {section.deferredZones.length > 0 ? (
              section.deferredZones.map((z) => (
                <li key={z}>
                  {z} (deferred)
                </li>
              ))
            ) : (
              <li>None deferred</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Key assumptions
        </h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {section.keyAssumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Additional limitations
        </h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {section.caseSpecificLimitations.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
