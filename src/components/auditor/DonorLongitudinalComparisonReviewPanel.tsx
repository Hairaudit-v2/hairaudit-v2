"use client";

import { useMemo, useState } from "react";
import {
  DONOR_COMPARABILITY_LIMITATIONS,
  DONOR_LONGITUDINAL_COMPARISON_LABELS,
  DONOR_LONGITUDINAL_COMPARISON_STATES,
  type DonorComparabilityLimitation,
  type DonorComparisonProvenanceSource,
  type DonorLongitudinalComparisonRecord,
  type DonorLongitudinalComparisonState,
} from "@/lib/patient/donorLongitudinalComparison";

export type DonorLongitudinalComparisonReviewPanelProps = {
  reportId: string;
  initialRecord: DonorLongitudinalComparisonRecord | null;
  uploadTypes?: string[];
  uploads?: Array<{
    id: string;
    type: string;
    capturedAt?: string | null;
    signedUrl?: string | null;
  }>;
};

function provenanceBadge(source: DonorComparisonProvenanceSource): string {
  switch (source) {
    case "clinician_confirmation":
      return "Clinician confirmed";
    case "clinician_correction":
      return "Clinician corrected";
    default:
      return "Automated preparation";
  }
}

function PairCompare({
  viewLabel,
  baselineUrl,
  compareUrl,
  baselineLabel,
  compareLabel,
}: {
  viewLabel: string;
  baselineUrl: string | null;
  compareUrl: string | null;
  baselineLabel: string;
  compareLabel: string;
}) {
  const [mode, setMode] = useState<"side" | "slider">("side");
  const [pct, setPct] = useState(50);

  if (!baselineUrl && !compareUrl) {
    return (
      <div className="rounded border border-cyan-500/20 bg-black/20 p-2 text-[11px] text-cyan-200/70">
        {viewLabel}: no image URLs available for this pair.
      </div>
    );
  }

  return (
    <div className="rounded border border-cyan-500/20 bg-black/25 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-cyan-100">{viewLabel}</p>
        <div className="flex gap-1">
          <button
            type="button"
            className={`rounded px-2 py-0.5 text-[10px] ${
              mode === "side"
                ? "bg-cyan-700/60 text-cyan-50"
                : "bg-black/30 text-cyan-200/70"
            }`}
            onClick={() => setMode("side")}
          >
            Side-by-side
          </button>
          <button
            type="button"
            className={`rounded px-2 py-0.5 text-[10px] ${
              mode === "slider"
                ? "bg-cyan-700/60 text-cyan-50"
                : "bg-black/30 text-cyan-200/70"
            }`}
            onClick={() => setMode("slider")}
            disabled={!baselineUrl || !compareUrl}
          >
            Slider
          </button>
        </div>
      </div>

      {mode === "side" ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[10px] text-cyan-300/70">{baselineLabel}</p>
            {baselineUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={baselineUrl}
                alt={baselineLabel}
                className="h-28 w-full rounded object-cover"
              />
            ) : (
              <div className="flex h-28 items-center justify-center rounded bg-black/40 text-[10px] text-cyan-200/50">
                No image
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-[10px] text-cyan-300/70">{compareLabel}</p>
            {compareUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={compareUrl}
                alt={compareLabel}
                className="h-28 w-full rounded object-cover"
              />
            ) : (
              <div className="flex h-28 items-center justify-center rounded bg-black/40 text-[10px] text-cyan-200/50">
                No image
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <div className="relative h-36 w-full overflow-hidden rounded bg-black/40">
            {compareUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={compareUrl}
                alt={compareLabel}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            {baselineUrl ? (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${pct}%` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={baselineUrl}
                  alt={baselineLabel}
                  className="h-full max-w-none object-cover"
                  style={{ width: `${10000 / Math.max(pct, 1)}%`, maxWidth: "none" }}
                />
              </div>
            ) : null}
            <div
              className="absolute inset-y-0 w-0.5 bg-cyan-200"
              style={{ left: `${pct}%` }}
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-[10px] text-cyan-200/80">
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
 * HA-DONOR-HEALING-1C — auditor longitudinal donor comparison controls.
 * Professional-facing only.
 */
export default function DonorLongitudinalComparisonReviewPanel({
  reportId,
  initialRecord,
  uploadTypes = [],
  uploads = [],
}: DonorLongitudinalComparisonReviewPanelProps) {
  const [record, setRecord] = useState(initialRecord);
  const [nextState, setNextState] = useState<DonorLongitudinalComparisonState>(
    initialRecord?.overallState ?? "insufficient_longitudinal_evidence"
  );
  const [limitations, setLimitations] = useState<DonorComparabilityLimitation[]>(
    initialRecord?.comparability.limitations ?? []
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const urlByUploadId = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const u of uploads) {
      map[u.id] = u.signedUrl ?? null;
    }
    return map;
  }, [uploads]);

  function toggleLimitation(lim: DonorComparabilityLimitation) {
    setLimitations((prev) =>
      prev.includes(lim) ? prev.filter((x) => x !== lim) : [...prev, lim]
    );
  }

  async function runAction(action: "confirm" | "correct" | "prepare") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auditor/donor-longitudinal-comparison", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId,
          action,
          nextState: action === "correct" ? nextState : undefined,
          limitations,
          uploadTypes,
          uploads: uploads.map((u) => ({
            id: u.id,
            type: u.type,
            capturedAt: u.capturedAt ?? null,
            signedUrl: u.signedUrl ?? null,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      setMessage(
        action === "confirm"
          ? "Comparison confirmed for patient report (snapshot frozen)."
          : action === "correct"
            ? "Comparison corrected; provenance and snapshot appended."
            : "Automated longitudinal comparison prepared."
      );
      if (json?.record) {
        const next = json.record as DonorLongitudinalComparisonRecord;
        setRecord(next);
        setNextState(next.overallState);
        setLimitations(next.comparability.limitations ?? []);
      } else if (json?.comparison?.overallState) {
        setNextState(json.comparison.overallState as DonorLongitudinalComparisonState);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const setById = useMemo(() => {
    const m = new Map<string, { label: string }>();
    for (const s of record?.sets ?? []) m.set(s.id, { label: s.label });
    return m;
  }, [record]);

  return (
    <div
      className="mt-4 rounded-xl border border-teal-500/25 bg-teal-950/20 px-4 py-3 text-left"
      data-testid="donor-longitudinal-comparison-review"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-200/90">
        Longitudinal donor comparison
      </p>
      <p className="mt-1 text-xs text-teal-100/85">
        Compare dated donor photo sets by matching rear, left, and right views. Confirm before any
        patient-facing conclusion. Do not claim follicle death, density loss, overharvesting, or
        graft capacity from photographs alone.
      </p>

      {record ? (
        <div className="mt-3 space-y-2 text-[11px] text-teal-50/90">
          <p>
            <span className="text-teal-300/70">Current state: </span>
            {DONOR_LONGITUDINAL_COMPARISON_LABELS[record.overallState]}
          </p>
          <p>
            <span className="text-teal-300/70">Provenance: </span>
            {provenanceBadge(record.provenance.source)}
            {record.provenance.confirmedAt
              ? ` · ${new Date(record.provenance.confirmedAt).toLocaleString()}`
              : ""}
          </p>
          <p>
            <span className="text-teal-300/70">Evidence: </span>
            {record.sets.length} set{record.sets.length === 1 ? "" : "s"} ·{" "}
            {record.pairs.length} view pair{record.pairs.length === 1 ? "" : "s"} ·{" "}
            {record.comparability.scoreBand}
            {record.snapshots.length
              ? ` · ${record.snapshots.length} frozen snapshot${
                  record.snapshots.length === 1 ? "" : "s"
                }`
              : ""}
          </p>
          {record.comparability.reasons.length > 0 && (
            <ul className="list-disc pl-4 text-teal-200/75">
              {record.comparability.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}

          {record.pairs.length > 0 && (
            <div className="mt-3 space-y-2">
              {record.pairs.map((p) => (
                <PairCompare
                  key={`${p.view}-${p.baselineSetId}-${p.compareSetId}`}
                  viewLabel={`${p.view} donor`}
                  baselineLabel={setById.get(p.baselineSetId)?.label ?? "Earlier"}
                  compareLabel={setById.get(p.compareSetId)?.label ?? "Later"}
                  baselineUrl={
                    p.baseline.signedUrl ?? urlByUploadId[p.baseline.uploadId] ?? null
                  }
                  compareUrl={
                    p.compare.signedUrl ?? urlByUploadId[p.compare.uploadId] ?? null
                  }
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-teal-100/80">
          No longitudinal comparison yet. Prepare from dated donor photo sets (rear / left / right).
        </p>
      )}

      <div className="mt-3">
        <p className="text-[11px] text-teal-100/90">Comparability limitations</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {DONOR_COMPARABILITY_LIMITATIONS.map((lim) => (
            <label
              key={lim}
              className="flex items-center gap-1.5 rounded border border-teal-500/25 bg-black/25 px-2 py-1 text-[10px] text-teal-50"
            >
              <input
                type="checkbox"
                checked={limitations.includes(lim)}
                onChange={() => toggleLimitation(lim)}
                disabled={busy}
              />
              {lim.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-teal-100/90">
          Correct to
          <select
            className="rounded border border-teal-500/30 bg-black/40 px-2 py-1.5 text-xs text-teal-50"
            value={nextState}
            onChange={(e) =>
              setNextState(e.target.value as DonorLongitudinalComparisonState)
            }
            disabled={busy}
          >
            {DONOR_LONGITUDINAL_COMPARISON_STATES.map((state) => (
              <option key={state} value={state}>
                {DONOR_LONGITUDINAL_COMPARISON_LABELS[state]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction("prepare")}
          className="rounded border border-teal-400/40 bg-black/30 px-3 py-1.5 text-xs font-medium text-teal-50 hover:bg-teal-950/60 disabled:opacity-60"
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
