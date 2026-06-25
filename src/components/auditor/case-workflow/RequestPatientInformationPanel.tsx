"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildPatientInfoRequestEmailContent,
  PATIENT_INFO_REQUEST_TYPES,
  patientSafeRequestReasonLabel,
  type PatientInfoRequestType,
} from "@/lib/auditor/patientInfoRequest";

type Props = {
  caseId: string;
  patientName: string;
  /** When true, show confirmation banner (server state after a prior send). */
  infoRequestPending?: boolean;
};

const REQUEST_TYPE_LABELS: Record<PatientInfoRequestType, string> = {
  more_photos_needed: "More photos needed",
  procedure_details_needed: "Procedure details needed",
  medication_history_needed: "Medication history needed",
  clinic_or_surgery_details_needed: "Clinic or surgery details needed",
  other: "Other information needed",
};

export default function RequestPatientInformationPanel({
  caseId,
  patientName,
  infoRequestPending = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState<PatientInfoRequestType>("more_photos_needed");
  const [auditorNote, setAuditorNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const preview = useMemo(
    () =>
      buildPatientInfoRequestEmailContent({
        caseId,
        patientName,
        requestType,
        auditorNote,
      }),
    [caseId, patientName, requestType, auditorNote]
  );

  async function sendRequest() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auditor/cases/request-patient-information", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, requestType, auditorNote: auditorNote.trim() || undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Request failed");
      setOpen(false);
      setJustSent(true);
      setAuditorNote("");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const showBanner = infoRequestPending || justSent;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Patient communication</h2>
          <p className="mt-1 text-sm text-slate-400">
            Request additional information from the patient before completing the report.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="shrink-0 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15"
        >
          Request more information
        </button>
      </header>

      {showBanner ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-950/30 px-4 py-3">
          <p className="text-sm font-medium text-emerald-100">Information request sent to patient</p>
          <p className="mt-1 text-xs text-emerald-200/80">
            The patient will receive a secure email with instructions to continue their review.
          </p>
        </div>
      ) : null}

      {error && !open ? <p className="text-sm text-rose-300">{error}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 p-4 pt-16">
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            role="dialog"
            aria-labelledby="request-info-title"
          >
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 id="request-info-title" className="text-lg font-semibold text-white">
                Request more information
              </h3>
              <p className="mt-1 text-sm text-slate-400">Case: {patientName}</p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label htmlFor="request-type" className="block text-sm font-medium text-slate-200">
                  Request reason
                </label>
                <select
                  id="request-type"
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as PatientInfoRequestType)}
                  className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  {PATIENT_INFO_REQUEST_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {REQUEST_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-400">
                  Patient will see: {patientSafeRequestReasonLabel(requestType)}
                </p>
              </div>

              <div>
                <label htmlFor="auditor-note" className="block text-sm font-medium text-slate-200">
                  Optional note for patient
                </label>
                <textarea
                  id="auditor-note"
                  rows={3}
                  value={auditorNote}
                  onChange={(e) => setAuditorNote(e.target.value)}
                  placeholder="Optional supportive note (kept calm and patient-safe)"
                  className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-200">Email preview</p>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</p>
                  <p className="mt-1 text-sm text-slate-200">{preview.subject}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Body</p>
                  <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-slate-300">{preview.text}</pre>
                </div>
              </div>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  setOpen(false);
                  setError(null);
                }}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendRequest()}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send request email"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
