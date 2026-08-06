"use client";

/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Auditor correction surface (professional layer).
 * Forensic / clinical terminology OK. Never rendered in patient reports.
 */

import { useCallback, useEffect, useState } from "react";
import {
  PROJECTION_CORRECTION_CODES,
  type PreSurgeryProjectionCorrection,
  type ProjectionCorrectionCode,
} from "@/lib/preSurgeryIntelligence/projectionCorrections";

const CODE_LABELS: Record<ProjectionCorrectionCode, string> = {
  incorrect_coverage: "Incorrect coverage",
  incorrect_hairline: "Incorrect hairline",
  excessive_density_implication: "Excessive density implication",
  deferred_zone_filled: "Deferred zone filled",
  wrong_mode: "Wrong projection mode",
  zone_boundary_error: "Zone boundary error",
  identity_or_anatomy_distortion: "Identity / anatomy distortion",
  donor_implication_misleading: "Donor implication misleading",
  other_clinical_error: "Other clinical error",
};

export default function ProjectionAuditorCorrectionPanel({
  caseId,
  projectionSnapshotId,
  projectionVersion,
}: {
  caseId: string;
  projectionSnapshotId: string;
  projectionVersion: number;
}) {
  const [corrections, setCorrections] = useState<PreSurgeryProjectionCorrection[]>([]);
  const [codes, setCodes] = useState<ProjectionCorrectionCode[]>([]);
  const [note, setNote] = useState("");
  const [zoneRefs, setZoneRefs] = useState("");
  /** When set, Record submits as an adjustment superseding this correction id. */
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(
      `/api/cases/${caseId}/pre-surgery-intelligence/projection/corrections?projectionId=${encodeURIComponent(
        projectionSnapshotId
      )}`,
      { credentials: "include" }
    );
    if (!res.ok) return;
    const data = (await res.json()) as { corrections?: PreSurgeryProjectionCorrection[] };
    setCorrections(data.corrections ?? []);
  }, [caseId, projectionSnapshotId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function resetForm() {
    setNote("");
    setCodes([]);
    setZoneRefs("");
    setAdjustingId(null);
  }

  function beginAdjust(c: PreSurgeryProjectionCorrection) {
    setCodes(c.correctionCodes);
    setNote(c.clinicalNote);
    setZoneRefs(c.zoneRefs.join(", "));
    setAdjustingId(c.id);
    setError(null);
    setMessage("Edit the fields below, then save the adjustment.");
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/cases/${caseId}/pre-surgery-intelligence/projection/corrections`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectionSnapshotId,
            correctionCodes: codes,
            clinicalNote: note,
            zoneRefs: zoneRefs
              .split(",")
              .map((z) => z.trim())
              .filter(Boolean),
            supersedesCorrectionId: adjustingId,
          }),
        }
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to save correction");
        return;
      }
      setMessage(
        adjustingId
          ? "Correction adjusted. Projection snapshot imagery was not modified."
          : "Correction recorded. Projection snapshot imagery was not modified."
      );
      resetForm();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      data-testid="projection-auditor-corrections"
      className="rounded-xl border border-amber-300/60 bg-amber-50/40 p-4"
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-amber-950">
        Forensic projection corrections
      </h3>
      <p className="mt-1 text-xs text-amber-900/80">
        Mark incorrect illustrative regions after review. Corrections are internal-only and do not
        alter the immutable approved projection snapshot (v{projectionVersion}).
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PROJECTION_CORRECTION_CODES.map((code) => {
          const on = codes.includes(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() =>
                setCodes((prev) =>
                  on ? prev.filter((c) => c !== code) : [...prev, code]
                )
              }
              className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                on
                  ? "border-amber-800 bg-amber-800 text-white"
                  : "border-amber-300 bg-white text-amber-950"
              }`}
            >
              {CODE_LABELS[code]}
            </button>
          );
        })}
      </div>

      <label className="mt-3 block text-xs font-semibold text-amber-950">
        Zone refs (comma-separated)
        <input
          value={zoneRefs}
          onChange={(e) => setZoneRefs(e.target.value)}
          className="mt-1 w-full rounded border border-amber-200 bg-white px-2 py-1.5 text-sm"
          placeholder="hairline, crown"
        />
      </label>

      <label className="mt-3 block text-xs font-semibold text-amber-950">
        Clinical note
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-amber-200 bg-white px-2 py-1.5 text-sm"
          placeholder="Describe the forensic / clinical discrepancy…"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || codes.length === 0 || note.trim().length < 8}
          onClick={() => void submit()}
          className="rounded bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {adjustingId ? "Save adjustment" : "Record correction"}
        </button>
        {adjustingId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              resetForm();
              setMessage(null);
            }}
            className="rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950"
          >
            Cancel adjust
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="mt-2 text-xs font-semibold text-emerald-800">{message}</p> : null}

      <ul className="mt-4 space-y-2">
        {corrections
          .filter((c) => c.status !== "withdrawn")
          .map((c) => (
            <li
              key={c.id}
              className="rounded border border-amber-200 bg-white p-3 text-xs text-slate-800"
            >
              <div className="font-semibold">
                {c.status} · {c.correctionCodes.map((x) => CODE_LABELS[x] ?? x).join(", ")}
                {adjustingId === c.id ? " · editing" : ""}
              </div>
              <p className="mt-1 text-slate-700">{c.clinicalNote}</p>
              {c.zoneRefs.length > 0 ? (
                <p className="mt-1 text-slate-500">Zones: {c.zoneRefs.join(", ")}</p>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className="mt-2 text-[11px] font-semibold text-amber-900 underline"
                onClick={() => beginAdjust(c)}
              >
                Adjust after review
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}
