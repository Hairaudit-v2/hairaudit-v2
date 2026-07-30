"use client";

import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";
import type { NormalisedPoint } from "@/lib/preSurgeryIntelligence/types";
import {
  DONOR_ZONE_INTENSITY_LABELS,
  type DonorZoneAnnotationItem,
  type DonorZoneIntensity,
} from "@/lib/patient/donorZoneAnnotation";

const INTENSITY_STROKE: Record<DonorZoneIntensity, string> = {
  broadly_even_appearance: "rgba(52, 211, 153, 0.85)",
  mild_visible_irregularity: "rgba(250, 204, 21, 0.9)",
  moderate_visible_irregularity: "rgba(251, 146, 60, 0.9)",
  marked_visible_irregularity: "rgba(248, 113, 113, 0.95)",
  not_assessable: "rgba(148, 163, 184, 0.8)",
};

const INTENSITY_FILL: Record<DonorZoneIntensity, string> = {
  broadly_even_appearance: "rgba(52, 211, 153, 0.18)",
  mild_visible_irregularity: "rgba(250, 204, 21, 0.2)",
  moderate_visible_irregularity: "rgba(251, 146, 60, 0.22)",
  marked_visible_irregularity: "rgba(248, 113, 113, 0.25)",
  not_assessable: "rgba(148, 163, 184, 0.15)",
};

export type DonorZoneOverlayCanvasProps = {
  imageUrl: string | null;
  imageAlt?: string;
  annotations: DonorZoneAnnotationItem[];
  drawing: boolean;
  draftPoints: NormalisedPoint[];
  onDraftPointsChange: (points: NormalisedPoint[]) => void;
  onSelectAnnotation?: (id: string) => void;
  selectedAnnotationId?: string | null;
};

function toSvgPoints(coords: NormalisedPoint[]): string {
  return coords.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
}

/**
 * HA-DONOR-HEALING-1D — SVG overlay for clinician polygon drawing on donor photos.
 * Coordinates are normalised 0–1 relative to the displayed image box.
 */
export default function DonorZoneOverlayCanvas({
  imageUrl,
  imageAlt = "Donor photograph",
  annotations,
  drawing,
  draftPoints,
  onDraftPointsChange,
  onSelectAnnotation,
  selectedAnnotationId,
}: DonorZoneOverlayCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [naturalReady, setNaturalReady] = useState(false);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!drawing || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      onDraftPointsChange([...draftPoints, { x, y }]);
    },
    [drawing, draftPoints, onDraftPointsChange]
  );

  const draftPolyline = useMemo(() => toSvgPoints(draftPoints), [draftPoints]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded border border-teal-500/30 bg-black/40 ${
        drawing ? "cursor-crosshair" : "cursor-default"
      }`}
      data-testid="donor-zone-overlay-canvas"
      onClick={handleClick}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={imageAlt}
          className="block h-56 w-full object-contain sm:h-72"
          onLoad={() => setNaturalReady(true)}
          draggable={false}
        />
      ) : (
        <div className="flex h-56 items-center justify-center text-xs text-teal-200/60 sm:h-72">
          Select a donor photo to annotate
        </div>
      )}

      {(imageUrl || naturalReady) && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {annotations.map((a) => {
            const selected = a.id === selectedAnnotationId;
            const stroke = INTENSITY_STROKE[a.intensity];
            const fill = INTENSITY_FILL[a.intensity];
            const pts = toSvgPoints(a.coordinates);
            if (a.geometryType === "point" && a.coordinates[0]) {
              const p = a.coordinates[0];
              return (
                <circle
                  key={a.id}
                  cx={p.x * 100}
                  cy={p.y * 100}
                  r={selected ? 2.2 : 1.6}
                  fill={stroke}
                  className="pointer-events-auto cursor-pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectAnnotation?.(a.id);
                  }}
                >
                  <title>{DONOR_ZONE_INTENSITY_LABELS[a.intensity]}</title>
                </circle>
              );
            }
            if (a.geometryType === "polyline") {
              return (
                <polyline
                  key={a.id}
                  points={pts}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={selected ? 1.2 : 0.8}
                  className="pointer-events-auto cursor-pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectAnnotation?.(a.id);
                  }}
                >
                  <title>{DONOR_ZONE_INTENSITY_LABELS[a.intensity]}</title>
                </polyline>
              );
            }
            return (
              <polygon
                key={a.id}
                points={pts}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected ? 1.2 : 0.7}
                className="pointer-events-auto cursor-pointer"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectAnnotation?.(a.id);
                }}
              >
                <title>{DONOR_ZONE_INTENSITY_LABELS[a.intensity]}</title>
              </polygon>
            );
          })}

          {draftPoints.length > 0 && (
            <>
              {draftPoints.length >= 2 ? (
                <polyline
                  points={draftPolyline}
                  fill="none"
                  stroke="rgba(45, 212, 191, 0.95)"
                  strokeWidth={0.9}
                  strokeDasharray="2 1.5"
                />
              ) : null}
              {draftPoints.map((p, i) => (
                <circle
                  key={`draft-${i}`}
                  cx={p.x * 100}
                  cy={p.y * 100}
                  r={1.4}
                  fill="rgba(45, 212, 191, 1)"
                />
              ))}
            </>
          )}
        </svg>
      )}

      {drawing ? (
        <p className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-teal-100">
          Click to add vertices · finish with Finish polygon (≥3 points)
        </p>
      ) : null}
    </div>
  );
}
