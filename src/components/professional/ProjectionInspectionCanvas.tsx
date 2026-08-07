"use client";

/**
 * Clinical-scale projection inspection: zoom, pan, fit, 1:1, before/after, mask toggles.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type InspectionViewId =
  | "original"
  | "hairline"
  | "allocation"
  | "outcome"
  | "compare";

type ViewSpec = {
  id: InspectionViewId;
  label: string;
  url: string | null;
  emptyHint?: string;
};

type Props = {
  views: ViewSpec[];
  activeView: InspectionViewId;
  onViewChange: (id: InspectionViewId) => void;
  beforeUrl?: string | null;
  afterUrl?: string | null;
  maskUrl?: string | null;
  testId?: string;
};

export default function ProjectionInspectionCanvas({
  views,
  activeView,
  onViewChange,
  beforeUrl,
  afterUrl,
  maskUrl,
  testId = "psi-spp-inspection-canvas",
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [showMask, setShowMask] = useState(false);
  const [showPreservation, setShowPreservation] = useState(false);
  const [comparePct, setComparePct] = useState(50);
  const [pixelMode, setPixelMode] = useState(false);

  const active = views.find((v) => v.id === activeView) ?? views[0];
  const canCompare = Boolean(beforeUrl && afterUrl);
  const canMask = Boolean(maskUrl);

  const fit = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPixelMode(false);
  }, []);

  const actualPixels = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPixelMode(true);
  }, []);

  useEffect(() => {
    fit();
  }, [activeView, fit]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || !dragOrigin.current) return;
    setPan({
      x: dragOrigin.current.panX + (e.clientX - dragOrigin.current.x),
      y: dragOrigin.current.panY + (e.clientY - dragOrigin.current.y),
    });
  }

  function onPointerUp() {
    setDragging(false);
    dragOrigin.current = null;
  }

  function renderImage(url: string | null, label: string) {
    if (!url) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center text-sm text-[var(--ha-muted-foreground)]">
          {label}
        </div>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        draggable={false}
        className={`pointer-events-none select-none ${
          pixelMode ? "max-w-none" : "max-h-full max-w-full object-contain"
        }`}
        style={
          pixelMode
            ? { imageRendering: "pixelated", transform: `scale(${zoom})`, transformOrigin: "center" }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex flex-wrap gap-1" role="tablist" data-testid="psi-spp-inspect-views">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={activeView === v.id}
            data-testid={`psi-spp-view-${v.id}`}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              activeView === v.id
                ? "border-[var(--ha-primary)] bg-[var(--ha-primary)]/10 font-semibold"
                : "border-[var(--ha-border)]"
            }`}
            onClick={() => onViewChange(v.id)}
          >
            {v.label}
          </button>
        ))}
        {canCompare ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "compare"}
            data-testid="psi-spp-view-compare"
            className={`rounded-md border px-2.5 py-1 text-xs ${
              activeView === "compare"
                ? "border-[var(--ha-primary)] bg-[var(--ha-primary)]/10 font-semibold"
                : "border-[var(--ha-border)]"
            }`}
            onClick={() => onViewChange("compare")}
          >
            Before / After
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button type="button" className="rounded border px-2 py-1" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
          Zoom in
        </button>
        <button type="button" className="rounded border px-2 py-1" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          Zoom out
        </button>
        <button type="button" className="rounded border px-2 py-1" data-testid="psi-spp-fit" onClick={fit}>
          Fit to screen
        </button>
        <button type="button" className="rounded border px-2 py-1" data-testid="psi-spp-1x" onClick={actualPixels}>
          Actual pixels
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1 disabled:opacity-40"
          disabled={!canMask}
          title={canMask ? "Toggle recipient mask overlay" : "Mask unavailable for this attempt"}
          data-testid="psi-spp-mask-toggle"
          aria-pressed={showMask}
          onClick={() => setShowMask((v) => !v)}
        >
          Mask {showMask ? "on" : "off"}
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1 disabled:opacity-40"
          disabled={!canMask}
          title={canMask ? "Highlight preservation / out-of-edit region" : "Mask unavailable"}
          data-testid="psi-spp-preserve-toggle"
          aria-pressed={showPreservation}
          onClick={() => setShowPreservation((v) => !v)}
        >
          Preservation {showPreservation ? "on" : "off"}
        </button>
        <span className="self-center text-[var(--ha-muted-foreground)]">{Math.round(zoom * 100)}%</span>
      </div>

      <div
        ref={viewportRef}
        className="relative h-[min(70vh,720px)] w-full cursor-grab overflow-hidden rounded-md border border-[var(--ha-border)] bg-[var(--ha-muted)]/30 active:cursor-grabbing"
        data-testid="psi-spp-inspect-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: pixelMode ? undefined : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          {activeView === "compare" && canCompare ? (
            <div className="relative h-full w-full max-w-full">
              <div className="absolute inset-0 flex items-center justify-center">
                {renderImage(afterUrl ?? null, "Outcome unavailable")}
              </div>
              <div
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - comparePct}% 0 0)` }}
              >
                {renderImage(beforeUrl ?? null, "Original unavailable")}
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
                style={{ left: `${comparePct}%` }}
              />
            </div>
          ) : (
            renderImage(active?.url ?? null, active?.emptyHint ?? "Asset unavailable")
          )}
        </div>

        {showMask && maskUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={maskUrl}
            alt=""
            className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain opacity-45 mix-blend-screen"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
            data-testid="psi-spp-mask-overlay"
          />
        ) : null}
        {showPreservation && maskUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={maskUrl}
            alt=""
            className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain opacity-35"
            style={{
              filter: "invert(1) sepia(1) saturate(5) hue-rotate(320deg)",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
            data-testid="psi-spp-preserve-overlay"
          />
        ) : null}
      </div>

      {activeView === "compare" && canCompare ? (
        <label className="flex items-center gap-2 text-xs" data-testid="psi-spp-compare-slider">
          <span>Before</span>
          <input
            type="range"
            min={0}
            max={100}
            value={comparePct}
            onChange={(e) => setComparePct(Number(e.target.value))}
            className="flex-1"
          />
          <span>After</span>
        </label>
      ) : null}
    </div>
  );
}
