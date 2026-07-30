"use client";

import { useMemo, useState } from "react";
import type { NormalisedPoint } from "@/lib/preSurgeryIntelligence/types";
import {
  DONOR_ZONE_IDS,
  DONOR_ZONE_INTENSITIES,
  DONOR_ZONE_INTENSITY_LABELS,
  DONOR_ZONE_LABELS,
  type DonorZoneAnnotationItem,
  type DonorZoneAnnotationRecord,
  type DonorZoneId,
  type DonorZoneIntensity,
  type DonorZoneProvenanceSource,
} from "@/lib/patient/donorZoneAnnotation";
import {
  classifyDonorComparisonView,
  stripPatientPhotoPrefix,
} from "@/lib/patient/donorLongitudinalComparison";
import DonorZoneOverlayCanvas from "@/components/auditor/DonorZoneOverlayCanvas";

export type DonorZoneAnnotationReviewPanelProps = {
  reportId: string;
  initialRecord: DonorZoneAnnotationRecord | null;
  uploads?: Array<{
    id: string;
    type: string;
    signedUrl?: string | null;
  }>;
};

function provenanceBadge(source: DonorZoneProvenanceSource): string {
  switch (source) {
    case "clinician_confirmation":
      return "Clinician confirmed";
    case "clinician_correction":
      return "Clinician corrected";
    default:
      return "Automated preparation";
  }
}

/**
 * HA-DONOR-HEALING-1D — auditor donor zone annotation controls.
 */
export default function DonorZoneAnnotationReviewPanel({
  reportId,
  initialRecord,
  uploads = [],
}: DonorZoneAnnotationReviewPanelProps) {
  const [record, setRecord] = useState(initialRecord);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const donorUploads = useMemo(() => {
    return uploads.filter((u) => {
      const key = stripPatientPhotoPrefix(u.type);
      return classifyDonorComparisonView(key) != null;
    });
  }, [uploads]);

  const [selectedUploadId, setSelectedUploadId] = useState<string>(
    donorUploads[0]?.id ?? ""
  );
  const selectedUpload = donorUploads.find((u) => u.id === selectedUploadId) ?? null;

  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<NormalisedPoint[]>([]);
  const [zoneId, setZoneId] = useState<DonorZoneId>("occipital");
  const [intensity, setIntensity] =
    useState<DonorZoneIntensity>("mild_visible_irregularity");
  const [note, setNote] = useState("");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(
    null
  );

  const annotationsForImage = useMemo(() => {
    if (!selectedUploadId || !record) return [] as DonorZoneAnnotationItem[];
    return record.annotations.filter((a) => a.uploadId === selectedUploadId);
  }, [record, selectedUploadId]);

  async function runAction(
    action:
      | "prepare"
      | "confirm"
      | "correct"
      | "upsert-annotation"
      | "delete-annotation",
    extra?: Record<string, unknown>
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auditor/donor-zone-annotation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      if (json?.record) setRecord(json.record as DonorZoneAnnotationRecord);
      setMessage(
        action === "confirm"
          ? "Zone annotation confirmed for patient schematic."
          : action === "correct"
            ? "Zone annotation corrected; snapshot appended."
            : action === "upsert-annotation"
              ? "Zone annotation saved."
              : action === "delete-annotation"
                ? "Zone annotation removed."
                : "Donor zone annotation shell prepared."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function finishPolygon() {
    if (!selectedUpload || draftPoints.length < 3) {
      setError("Need at least 3 points to finish a polygon.");
      return;
    }
    await runAction("upsert-annotation", {
      uploadId: selectedUpload.id,
      categoryKey: stripPatientPhotoPrefix(selectedUpload.type),
      zoneId,
      intensity,
      geometryType: "polygon",
      coordinates: draftPoints,
      note: note.trim() || null,
    });
    setDraftPoints([]);
    setDrawing(false);
    setNote("");
  }

  return (
    <div
      className="mt-4 rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 text-left"
      data-testid="donor-zone-annotation-review"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">
        Donor zone annotation
      </p>
      <p className="mt-1 text-xs text-violet-100/85">
        Paint qualitative zones on rear / left / right donor photos. Confirm before any
        patient-facing schematic. Do not claim density loss, follicle death, or graft capacity.
      </p>

      {record ? (
        <div className="mt-3 space-y-1 text-[11px] text-violet-50/90">
          <p>
            <span className="text-violet-300/70">Provenance: </span>
            {provenanceBadge(record.provenance.source)}
            {record.provenance.confirmedAt
              ? ` · ${new Date(record.provenance.confirmedAt).toLocaleString()}`
              : ""}
          </p>
          <p>
            <span className="text-violet-300/70">Annotations: </span>
            {record.annotations.length} · summaries {record.heatmapSummaries.length}
            {record.snapshots.length
              ? ` · ${record.snapshots.length} frozen snapshot${
                  record.snapshots.length === 1 ? "" : "s"
                }`
              : ""}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-violet-100/80">
          No zone annotation record yet. Prepare a shell, then draw zones on a donor photo.
        </p>
      )}

      <div className="mt-3">
        <label className="flex flex-col gap-1 text-[11px] text-violet-100/90">
          Donor photo
          <select
            className="rounded border border-violet-500/30 bg-black/40 px-2 py-1.5 text-xs text-violet-50"
            value={selectedUploadId}
            onChange={(e) => {
              setSelectedUploadId(e.target.value);
              setDraftPoints([]);
              setSelectedAnnotationId(null);
            }}
            disabled={busy || donorUploads.length === 0}
          >
            {donorUploads.length === 0 ? (
              <option value="">No donor views uploaded</option>
            ) : (
              donorUploads.map((u) => (
                <option key={u.id} value={u.id}>
                  {stripPatientPhotoPrefix(u.type)} ({u.id.slice(0, 8)})
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="mt-3">
        <DonorZoneOverlayCanvas
          imageUrl={selectedUpload?.signedUrl ?? null}
          annotations={annotationsForImage}
          drawing={drawing}
          draftPoints={draftPoints}
          onDraftPointsChange={setDraftPoints}
          selectedAnnotationId={selectedAnnotationId}
          onSelectAnnotation={setSelectedAnnotationId}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px] text-violet-100/90">
          Zone
          <select
            className="rounded border border-violet-500/30 bg-black/40 px-2 py-1.5 text-xs text-violet-50"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value as DonorZoneId)}
            disabled={busy}
          >
            {DONOR_ZONE_IDS.map((z) => (
              <option key={z} value={z}>
                {DONOR_ZONE_LABELS[z]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-violet-100/90">
          Intensity
          <select
            className="rounded border border-violet-500/30 bg-black/40 px-2 py-1.5 text-xs text-violet-50"
            value={intensity}
            onChange={(e) => setIntensity(e.target.value as DonorZoneIntensity)}
            disabled={busy}
          >
            {DONOR_ZONE_INTENSITIES.map((i) => (
              <option key={i} value={i}>
                {DONOR_ZONE_INTENSITY_LABELS[i]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-2 flex flex-col gap-1 text-[11px] text-violet-100/90">
        Note {zoneId === "custom" ? "(required for custom)" : "(optional)"}
        <input
          className="rounded border border-violet-500/30 bg-black/40 px-2 py-1.5 text-xs text-violet-50"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          placeholder="Visible appearance note — not a density claim"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !selectedUpload}
          onClick={() => {
            setDrawing(true);
            setDraftPoints([]);
          }}
          className="rounded border border-violet-400/40 bg-black/30 px-3 py-1.5 text-xs font-medium text-violet-50 hover:bg-violet-950/60 disabled:opacity-60"
        >
          Start drawing
        </button>
        <button
          type="button"
          disabled={busy || draftPoints.length < 3}
          onClick={() => finishPolygon()}
          className="rounded border border-cyan-400/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-50 hover:bg-cyan-900/50 disabled:opacity-60"
        >
          Finish polygon
        </button>
        <button
          type="button"
          disabled={busy || draftPoints.length === 0}
          onClick={() => {
            setDraftPoints([]);
            setDrawing(false);
          }}
          className="rounded border border-slate-400/30 bg-black/30 px-3 py-1.5 text-xs font-medium text-slate-100 disabled:opacity-60"
        >
          Cancel draft
        </button>
        <button
          type="button"
          disabled={busy || !selectedAnnotationId}
          onClick={() =>
            selectedAnnotationId
              ? runAction("delete-annotation", { annotationId: selectedAnnotationId })
              : undefined
          }
          className="rounded border border-rose-400/40 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-50 disabled:opacity-60"
        >
          Delete selected
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction("prepare")}
          className="rounded border border-violet-400/40 bg-black/30 px-3 py-1.5 text-xs font-medium text-violet-50 hover:bg-violet-950/60 disabled:opacity-60"
        >
          Prepare
        </button>
        <button
          type="button"
          disabled={busy || !record}
          onClick={() => runAction("confirm")}
          className="rounded border border-emerald-400/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-50 hover:bg-emerald-900/50 disabled:opacity-60"
        >
          Confirm
        </button>
        <button
          type="button"
          disabled={busy || !record}
          onClick={() => runAction("correct")}
          className="rounded border border-amber-400/40 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-900/50 disabled:opacity-60"
        >
          Correct
        </button>
      </div>

      {message && <p className="mt-2 text-xs text-emerald-200">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
