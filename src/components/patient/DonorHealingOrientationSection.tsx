"use client";

import type { PatientSafeDonorOrientationSlice } from "@/lib/patient/donorHealingOrientationReport";

/**
 * HA-DONOR-HEALING-1B — patient-safe donor orientation block.
 * Uses only approved orientation labels; never diagnostic certainty language.
 */
export default function DonorHealingOrientationSection({
  orientation,
}: {
  orientation: PatientSafeDonorOrientationSlice;
}) {
  return (
    <section
      data-testid="donor-healing-orientation-section"
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Donor healing orientation
      </p>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">{orientation.label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">
        {orientation.stageAwareNarrative}
      </p>
      {orientation.escalationCopy ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          {orientation.escalationCopy}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        {orientation.provenanceLabel}
        {!orientation.evidenceSufficient
          ? " · Evidence for this orientation is limited"
          : ""}
      </p>
    </section>
  );
}
