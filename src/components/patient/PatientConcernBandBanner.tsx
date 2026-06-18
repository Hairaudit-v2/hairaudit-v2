"use client";

import { getConcernBandDisplay, type PatientConcernBand } from "@/lib/reports/patientConcernBands";

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
      className={`rounded-xl border p-4 ${display.shellClassName}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed opacity-90">{body}</p>
      {band !== "none" ? (
        <p className="mt-2 text-xs opacity-80">
          Based on uploaded images only — not a medical diagnosis. Please discuss with your treating clinician.
        </p>
      ) : null}
    </div>
  );
}
