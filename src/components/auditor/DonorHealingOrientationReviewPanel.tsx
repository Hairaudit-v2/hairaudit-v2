"use client";

import { useState } from "react";
import {
  DONOR_HEALING_ORIENTATION_LABELS,
  DONOR_HEALING_ORIENTATION_STATES,
  type DonorHealingOrientation,
} from "@/lib/patient/donorHealingEntry";
import type {
  DonorHealingOrientationRecord,
  DonorOrientationProvenanceSource,
} from "@/lib/patient/donorHealingOrientationReport";

export type DonorHealingOrientationReviewPanelProps = {
  reportId: string;
  initialRecord: DonorHealingOrientationRecord | null;
  uploadTypes?: string[];
};

function provenanceBadge(source: DonorOrientationProvenanceSource): string {
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
 * HA-DONOR-HEALING-1B — auditor confirmation / correction controls.
 * Professional-facing only; does not expose Forensic AI product terms to patients.
 */
export default function DonorHealingOrientationReviewPanel({
  reportId,
  initialRecord,
  uploadTypes = [],
}: DonorHealingOrientationReviewPanelProps) {
  const [record, setRecord] = useState(initialRecord);
  const [nextState, setNextState] = useState<DonorHealingOrientation>(
    initialRecord?.state ?? "insufficient_evidence"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(action: "confirm" | "correct" | "prepare") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auditor/donor-healing-orientation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId,
          action,
          nextState: action === "correct" ? nextState : undefined,
          uploadTypes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      setMessage(
        action === "confirm"
          ? "Orientation confirmed for patient report."
          : action === "correct"
            ? "Orientation corrected and provenance appended."
            : "Automated orientation prepared."
      );
      if (json?.orientation?.state) {
        setNextState(json.orientation.state as DonorHealingOrientation);
        setRecord((prev) =>
          prev
            ? {
                ...prev,
                state: json.orientation.state,
                patientLabel: json.orientation.patientLabel,
                provenance: {
                  ...prev.provenance,
                  source: json.orientation.provenanceSource,
                  confirmedAt: json.orientation.confirmedAt,
                },
              }
            : prev
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-left"
      data-testid="donor-healing-orientation-review"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/90">
        Donor healing orientation
      </p>
      <p className="mt-1 text-xs text-cyan-100/85">
        Confirm or correct the bounded donor orientation before treating it as clinician-reviewed.
        Patient output stays within the six approved orientation labels — never diagnostic certainty.
      </p>

      {record ? (
        <div className="mt-3 space-y-2 text-[11px] text-cyan-50/90">
          <p>
            <span className="text-cyan-300/70">Current state: </span>
            {DONOR_HEALING_ORIENTATION_LABELS[record.state]}
          </p>
          <p>
            <span className="text-cyan-300/70">Provenance: </span>
            {provenanceBadge(record.provenance.source)}
            {record.provenance.confirmedAt
              ? ` · ${new Date(record.provenance.confirmedAt).toLocaleString()}`
              : ""}
          </p>
          <p>
            <span className="text-cyan-300/70">Evidence: </span>
            {record.evidence.donorViewCount} donor view
            {record.evidence.donorViewCount === 1 ? "" : "s"}
            {record.evidence.hasTimingContext ? " · timing present" : " · timing missing"}
            {record.evidence.sufficient ? " · sufficient" : " · insufficient"}
          </p>
          {record.evidence.reasons.length > 0 && (
            <ul className="list-disc pl-4 text-cyan-200/75">
              {record.evidence.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-cyan-100/80">
          No orientation record yet. Prepare an automated mapping from intake + donor views.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-cyan-100/90">
          Correct to
          <select
            className="rounded border border-cyan-500/30 bg-black/40 px-2 py-1.5 text-xs text-cyan-50"
            value={nextState}
            onChange={(e) => setNextState(e.target.value as DonorHealingOrientation)}
            disabled={busy}
          >
            {DONOR_HEALING_ORIENTATION_STATES.map((state) => (
              <option key={state} value={state}>
                {DONOR_HEALING_ORIENTATION_LABELS[state]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction("prepare")}
          className="rounded border border-cyan-400/40 bg-black/30 px-3 py-1.5 text-xs font-medium text-cyan-50 hover:bg-cyan-950/60 disabled:opacity-60"
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
