"use client";

import { getConcernBandDisplay, type PatientConcernBand } from "@/lib/reports/patientConcernBands";

const LIGHT_BAND_CLASS: Record<PatientConcernBand, string> = {
  none: "border-emerald-200 bg-emerald-50 text-emerald-950",
  minor: "border-lime-200 bg-lime-50 text-lime-950",
  needs_review: "border-amber-200 bg-amber-50 text-amber-950",
  significant: "border-orange-200 bg-orange-50 text-orange-950",
  urgent: "border-rose-200 bg-rose-50 text-rose-950",
};

export default function PatientConcernBandBanner({
  band,
  label,
  description,
}: {
  band: PatientConcernBand;
  label?: string;
  description?: string;
}) {
  const display = getConcernBandDisplay(band);
  const title = label ?? display.label;
  const body = description ?? display.description;

  return (
    <div
      className={`rounded-xl border p-4 ${LIGHT_BAND_CLASS[band]}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed opacity-90">{body}</p>
      {band !== "none" ? (
        <p className="mt-2 text-xs leading-relaxed opacity-80">
          Based on uploaded images only — not a medical diagnosis. Please discuss with your treating clinician.
        </p>
      ) : null}
    </div>
  );
}
