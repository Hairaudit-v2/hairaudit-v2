"use client";

import { useState } from "react";
import type { PatientSafeDonorLongitudinalSlice } from "@/lib/patient/donorLongitudinalComparison";

function PatientPairCompare({
  viewLabel,
  baseline,
  compare,
}: {
  viewLabel: string;
  baseline: { label: string; signedUrl: string | null };
  compare: { label: string; signedUrl: string | null };
}) {
  const [mode, setMode] = useState<"side" | "slider">("side");
  const [pct, setPct] = useState(50);
  const canSlider = Boolean(baseline.signedUrl && compare.signedUrl);

  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
      data-testid="donor-longitudinal-pair"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{viewLabel}</p>
        <div className="flex gap-1">
          <button
            type="button"
            className={`rounded px-2 py-0.5 text-xs ${
              mode === "side"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 border border-slate-200"
            }`}
            onClick={() => setMode("side")}
          >
            Side-by-side
          </button>
          <button
            type="button"
            className={`rounded px-2 py-0.5 text-xs ${
              mode === "slider"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 border border-slate-200"
            }`}
            onClick={() => setMode("slider")}
            disabled={!canSlider}
          >
            Slider
          </button>
        </div>
      </div>

      {mode === "side" ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs text-slate-500">{baseline.label}</p>
            {baseline.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={baseline.signedUrl}
                alt={baseline.label}
                className="h-36 w-full rounded-md object-cover"
              />
            ) : (
              <div className="flex h-36 items-center justify-center rounded-md bg-slate-200 text-xs text-slate-500">
                Image unavailable
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">{compare.label}</p>
            {compare.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={compare.signedUrl}
                alt={compare.label}
                className="h-36 w-full rounded-md object-cover"
              />
            ) : (
              <div className="flex h-36 items-center justify-center rounded-md bg-slate-200 text-xs text-slate-500">
                Image unavailable
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="relative h-44 w-full overflow-hidden rounded-md bg-slate-200">
            {compare.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={compare.signedUrl}
                alt={compare.label}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            {baseline.signedUrl ? (
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={baseline.signedUrl}
                  alt={baseline.label}
                  className="h-full object-cover"
                  style={{ width: `${10000 / Math.max(pct, 1)}%`, maxWidth: "none" }}
                />
              </div>
            ) : null}
            <div
              className="absolute inset-y-0 w-0.5 bg-white shadow"
              style={{ left: `${pct}%` }}
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            Earlier ← → Later
            <input
              type="range"
              min={5}
              max={95}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="flex-1"
            />
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * HA-DONOR-HEALING-1C — patient-safe longitudinal donor comparison block.
 * Only rendered when clinician-confirmed/corrected slice is present.
 */
export default function DonorLongitudinalComparisonSection({
  comparison,
}: {
  comparison: PatientSafeDonorLongitudinalSlice;
}) {
  return (
    <section
      data-testid="donor-longitudinal-comparison-section"
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Donor appearance over time
      </p>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">{comparison.label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{comparison.narrative}</p>

      {comparison.limitations.length > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          Noted photograph limitations:{" "}
          {comparison.limitations.map((l) => l.replace(/_/g, " ")).join(", ")}.
        </p>
      ) : null}

      {comparison.pairs.length > 0 ? (
        <div className="mt-4 space-y-3">
          {comparison.pairs.map((p) => (
            <PatientPairCompare
              key={p.view}
              viewLabel={p.viewLabel}
              baseline={p.baseline}
              compare={p.compare}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-slate-500">{comparison.caveat}</p>
      <p className="mt-2 text-xs text-slate-500">{comparison.provenanceLabel}</p>
    </section>
  );
}
