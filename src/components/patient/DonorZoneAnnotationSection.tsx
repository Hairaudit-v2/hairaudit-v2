"use client";

import {
  DONOR_ZONE_PATIENT_LABELS,
  type DonorZoneId,
  type DonorZoneIntensity,
  type PatientSafeDonorZoneAnnotationSlice,
} from "@/lib/patient/donorZoneAnnotation";

const INTENSITY_FILL: Record<DonorZoneIntensity, string> = {
  broadly_even_appearance: "#86efac",
  mild_visible_irregularity: "#fde047",
  moderate_visible_irregularity: "#fdba74",
  marked_visible_irregularity: "#fca5a5",
  not_assessable: "#cbd5e1",
};

/** Approximate schematic regions on a rear-facing donor silhouette (viewBox 0–100). */
const SCHEMATIC_PATHS: Partial<Record<DonorZoneId, string>> = {
  occipital: "M38 28 H62 V52 H38 Z",
  parietal_left: "M18 30 H38 V48 H18 Z",
  parietal_right: "M62 30 H82 V48 H62 Z",
  temporal_left: "M12 48 H32 V68 H12 Z",
  temporal_right: "M68 48 H88 V68 H68 Z",
  nuchal: "M34 58 H66 V78 H34 Z",
  custom: "M42 18 H58 V26 H42 Z",
};

/**
 * HA-DONOR-HEALING-1D — patient-safe schematic (no painted photo heatmap).
 */
export default function DonorZoneAnnotationSection({
  annotation,
}: {
  annotation: PatientSafeDonorZoneAnnotationSlice;
}) {
  const intensityByZone = new Map(
    annotation.schematic.map((s) => [s.zoneId, s.intensity] as const)
  );

  return (
    <section
      data-testid="donor-zone-annotation-section"
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Donor zone appearance map
      </p>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">
        Where visible change was marked
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{annotation.narrative}</p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="mx-auto w-full max-w-[220px] shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="h-48 w-full rounded-lg border border-slate-200 bg-slate-50"
            role="img"
            aria-label="Schematic donor zone map"
          >
            <ellipse cx="50" cy="52" rx="40" ry="36" fill="#f1f5f9" stroke="#94a3b8" />
            {(Object.keys(SCHEMATIC_PATHS) as DonorZoneId[]).map((zoneId) => {
              const path = SCHEMATIC_PATHS[zoneId];
              if (!path) return null;
              const intensity = intensityByZone.get(zoneId);
              return (
                <path
                  key={zoneId}
                  d={path}
                  fill={intensity ? INTENSITY_FILL[intensity] : "transparent"}
                  stroke="#64748b"
                  strokeWidth={0.6}
                  opacity={intensity ? 0.9 : 0.25}
                >
                  <title>
                    {DONOR_ZONE_PATIENT_LABELS[zoneId]}
                    {intensity ? ` — ${intensity.replace(/_/g, " ")}` : ""}
                  </title>
                </path>
              );
            })}
          </svg>
          <p className="mt-1 text-center text-[10px] text-slate-500">
            Schematic only — not a density measurement
          </p>
        </div>

        <ul className="min-w-0 flex-1 space-y-2 text-sm text-slate-700">
          {annotation.zones.length === 0 ? (
            <li className="text-slate-500">No zones were confirmed for this review.</li>
          ) : (
            annotation.zones.map((z, idx) => (
              <li
                key={`${z.zoneId}-${z.view}-${idx}`}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <p className="font-medium text-slate-900">{z.zoneLabel}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {z.intensityLabel}
                  <span className="text-slate-400"> · {z.view} view</span>
                </p>
                {z.note ? (
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{z.note}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">{annotation.caveat}</p>
      <p className="mt-2 text-xs text-slate-500">{annotation.provenanceLabel}</p>
    </section>
  );
}
