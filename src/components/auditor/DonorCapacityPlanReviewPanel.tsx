"use client";

import { useState } from "react";
import {
  DONOR_CAPACITY_PLAN_LABELS,
  DONOR_CAPACITY_PLAN_STATES,
  type DonorCapacityPlanRecord,
  type DonorCapacityPlanState,
  type DonorCapacityProvenanceSource,
  type SourcedMeasurement,
} from "@/lib/patient/donorCapacityPlan";

export type DonorCapacityPlanReviewPanelProps = {
  reportId: string;
  initialRecord: DonorCapacityPlanRecord | null;
};

function provenanceBadge(source: DonorCapacityProvenanceSource): string {
  switch (source) {
    case "clinician_confirmation":
      return "Clinician confirmed";
    case "clinician_correction":
      return "Clinician corrected";
    default:
      return "Automated preparation";
  }
}

function sourceLabel(source: string): string {
  return source.replace(/_/g, " ");
}

function FieldRow({
  label,
  sourced,
  hint,
}: {
  label: string;
  sourced: SourcedMeasurement<string | number> | null | undefined;
  hint?: string | null;
}) {
  return (
    <div className="rounded border border-amber-500/20 bg-black/25 px-2 py-1.5 text-[11px]">
      <p className="text-amber-200/80">{label}</p>
      {sourced ? (
        <p className="mt-0.5 text-amber-50">
          {String(sourced.value)}
          <span className="ml-1 text-amber-300/60">({sourceLabel(sourced.source)})</span>
        </p>
      ) : (
        <p className="mt-0.5 text-amber-200/50">Not on file</p>
      )}
      {hint ? (
        <p className="mt-0.5 text-[10px] text-amber-300/55">
          Patient report (unverified): {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * HA-DONOR-HEALING-1E — auditor capacity planning controls.
 * Shows source-tagged clinical measurements; patient hints are non-qualifying.
 */
export default function DonorCapacityPlanReviewPanel({
  reportId,
  initialRecord,
}: DonorCapacityPlanReviewPanelProps) {
  const [record, setRecord] = useState(initialRecord);
  const [nextState, setNextState] = useState<DonorCapacityPlanState>(
    initialRecord?.overallState ?? "insufficient_clinical_measurements"
  );
  const [densityCm2, setDensityCm2] = useState(
    initialRecord?.measurements.densityCm2?.value?.toString() ?? ""
  );
  const [graftsRemoved, setGraftsRemoved] = useState(
    initialRecord?.measurements.graftsRemoved?.value?.toString() ?? ""
  );
  const [punchSizeMm, setPunchSizeMm] = useState(
    initialRecord?.measurements.punchSizeMm?.value?.toString() ?? ""
  );
  const [estimatedOrdinal, setEstimatedOrdinal] = useState(
    initialRecord?.measurements.estimatedCapacityOrdinal?.value ?? ""
  );
  const [internalNote, setInternalNote] = useState(
    initialRecord?.clinicianInternalNote ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function syncFromRecord(next: DonorCapacityPlanRecord) {
    setRecord(next);
    setNextState(next.overallState);
    setDensityCm2(next.measurements.densityCm2?.value?.toString() ?? "");
    setGraftsRemoved(next.measurements.graftsRemoved?.value?.toString() ?? "");
    setPunchSizeMm(next.measurements.punchSizeMm?.value?.toString() ?? "");
    setEstimatedOrdinal(next.measurements.estimatedCapacityOrdinal?.value ?? "");
    setInternalNote(next.clinicianInternalNote ?? "");
  }

  async function runAction(
    action: "prepare" | "confirm" | "correct" | "upsert-measurements"
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { reportId, action };
      if (action === "correct") payload.nextState = nextState;
      if (action === "upsert-measurements" || action === "correct") {
        payload.clinicianInternalNote = internalNote || null;
      }
      if (action === "upsert-measurements") {
        payload.densityCm2 = densityCm2.trim() ? Number(densityCm2) : null;
        payload.graftsRemoved = graftsRemoved.trim() ? Number(graftsRemoved) : null;
        payload.punchSizeMm = punchSizeMm.trim() ? Number(punchSizeMm) : null;
        payload.estimatedCapacityOrdinal = estimatedOrdinal.trim() || null;
      }

      const res = await fetch("/api/auditor/donor-capacity-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      if (json?.record) syncFromRecord(json.record as DonorCapacityPlanRecord);
      setMessage(
        action === "confirm"
          ? "Capacity plan confirmed for patient report (qualitative only)."
          : action === "correct"
            ? "Capacity plan corrected; snapshot appended."
            : action === "upsert-measurements"
              ? "Auditor measurements saved (source: auditor entry)."
              : "Automated capacity plan prepared from clinical sources."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-4 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-left"
      data-testid="donor-capacity-plan-review"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
        Future donor-capacity planning
      </p>
      <p className="mt-1 text-xs text-amber-100/85">
        Plan from clinical measurements only. Patient self-report is supporting context and never
        enough alone. Patient output stays qualitative — no remaining-graft numbers.
      </p>

      {record ? (
        <div className="mt-3 space-y-2 text-[11px] text-amber-50/90">
          <p>
            <span className="text-amber-300/70">Current state: </span>
            {DONOR_CAPACITY_PLAN_LABELS[record.overallState]}
          </p>
          <p>
            <span className="text-amber-300/70">Provenance: </span>
            {provenanceBadge(record.provenance.source)}
            {record.provenance.confirmedAt
              ? ` · ${new Date(record.provenance.confirmedAt).toLocaleString()}`
              : ""}
          </p>
          <p>
            <span className="text-amber-300/70">Sufficiency: </span>
            {record.sufficiency.qualifyingCount} qualifying measurement
            {record.sufficiency.qualifyingCount === 1 ? "" : "s"}
            {record.sufficiency.sufficient ? " · sufficient" : " · insufficient"}
            {record.snapshots.length
              ? ` · ${record.snapshots.length} frozen snapshot${
                  record.snapshots.length === 1 ? "" : "s"
                }`
              : ""}
          </p>
          {record.sufficiency.reasons.length > 0 && (
            <ul className="list-disc pl-4 text-amber-200/70">
              {record.sufficiency.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <FieldRow
              label="Density (per cm²)"
              sourced={record.measurements.densityCm2}
            />
            <FieldRow
              label="Grafts removed"
              sourced={record.measurements.graftsRemoved}
              hint={record.patientHints.graftNumberReported}
            />
            <FieldRow
              label="Punch size (mm)"
              sourced={record.measurements.punchSizeMm}
              hint={record.patientHints.punchSizeKnown}
            />
            <FieldRow
              label="Estimated capacity (ordinal)"
              sourced={record.measurements.estimatedCapacityOrdinal}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-amber-100/80">
          No capacity plan yet. Prepare from clinic/doctor/clinical history measurements.
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px] text-amber-100/90">
          Auditor density cm²
          <input
            className="rounded border border-amber-500/30 bg-black/40 px-2 py-1.5 text-xs text-amber-50"
            value={densityCm2}
            onChange={(e) => setDensityCm2(e.target.value)}
            disabled={busy}
            inputMode="decimal"
            placeholder="e.g. 65"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-amber-100/90">
          Auditor grafts removed
          <input
            className="rounded border border-amber-500/30 bg-black/40 px-2 py-1.5 text-xs text-amber-50"
            value={graftsRemoved}
            onChange={(e) => setGraftsRemoved(e.target.value)}
            disabled={busy}
            inputMode="numeric"
            placeholder="e.g. 3200"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-amber-100/90">
          Auditor punch size mm
          <input
            className="rounded border border-amber-500/30 bg-black/40 px-2 py-1.5 text-xs text-amber-50"
            value={punchSizeMm}
            onChange={(e) => setPunchSizeMm(e.target.value)}
            disabled={busy}
            inputMode="decimal"
            placeholder="e.g. 0.9"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-amber-100/90">
          Auditor capacity ordinal
          <input
            className="rounded border border-amber-500/30 bg-black/40 px-2 py-1.5 text-xs text-amber-50"
            value={estimatedOrdinal}
            onChange={(e) => setEstimatedOrdinal(e.target.value)}
            disabled={busy}
            placeholder="e.g. moderate / limited"
          />
        </label>
      </div>

      <label className="mt-2 flex flex-col gap-1 text-[11px] text-amber-100/90">
        Internal note (auditor only — not shown to patients as graft counts)
        <input
          className="rounded border border-amber-500/30 bg-black/40 px-2 py-1.5 text-xs text-amber-50"
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          disabled={busy}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-amber-100/90">
          Correct to
          <select
            className="rounded border border-amber-500/30 bg-black/40 px-2 py-1.5 text-xs text-amber-50"
            value={nextState}
            onChange={(e) => setNextState(e.target.value as DonorCapacityPlanState)}
            disabled={busy}
          >
            {DONOR_CAPACITY_PLAN_STATES.map((state) => (
              <option key={state} value={state}>
                {DONOR_CAPACITY_PLAN_LABELS[state]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction("prepare")}
          className="rounded border border-amber-400/40 bg-black/30 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-950/60 disabled:opacity-60"
        >
          Prepare
        </button>
        <button
          type="button"
          disabled={busy || !record}
          onClick={() => runAction("upsert-measurements")}
          className="rounded border border-cyan-400/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-50 disabled:opacity-60"
        >
          Save measurements
        </button>
        <button
          type="button"
          disabled={busy || !record}
          onClick={() => runAction("confirm")}
          className="rounded border border-emerald-400/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-50 disabled:opacity-60"
        >
          Confirm
        </button>
        <button
          type="button"
          disabled={busy || !record}
          onClick={() => runAction("correct")}
          className="rounded border border-rose-400/40 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-50 disabled:opacity-60"
        >
          Correct
        </button>
      </div>

      {message && <p className="mt-2 text-xs text-emerald-200">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
