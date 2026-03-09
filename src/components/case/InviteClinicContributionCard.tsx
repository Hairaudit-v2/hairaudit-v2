"use client";

import { useMemo, useState } from "react";

type Props = {
  caseId: string;
  disabled?: boolean;
  defaultClinicName?: string;
  defaultDoctorName?: string;
};

export default function InviteClinicContributionCard({
  caseId,
  disabled = false,
  defaultClinicName = "",
  defaultDoctorName = "",
}: Props) {
  const [clinicName, setClinicName] = useState(defaultClinicName);
  const [doctorName, setDoctorName] = useState(defaultDoctorName);
  const [clinicEmail, setClinicEmail] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [patientConsent, setPatientConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const validationError = useMemo(() => {
    if (!patientConsent) return "Please confirm consent before sending a request.";
    if (!clinicEmail.trim() && !doctorEmail.trim()) return "Add at least one email address (clinic or doctor).";
    return null;
  }, [clinicEmail, doctorEmail, patientConsent]);

  const onSubmit = async () => {
    setMessage(null);
    if (validationError) {
      setMessage({ type: "err", text: validationError });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/case-contribution-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          clinicName,
          doctorName,
          clinicEmail,
          doctorEmail,
          patientConsent,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to send contribution request.");
      setMessage({ type: "ok", text: "Contribution request sent." });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? "Unable to send contribution request." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-cyan-500/30 bg-slate-900 p-6">
      <h2 className="text-lg font-semibold text-white">Invite Clinic Contribution</h2>
      <p className="mt-2 text-sm text-slate-300">
        Allow HairAudit to contact your clinic or surgeon to request procedural documentation for a more complete forensic
        review of your case.
      </p>
      <p className="mt-2 text-xs text-cyan-200/90">
        You can send a contribution request even after your case has been submitted.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-200">
          Clinic Name
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="Clinic or practice name"
            disabled={disabled || submitting}
          />
        </label>
        <label className="text-sm text-slate-200">
          Doctor Name
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="Treating doctor name"
            disabled={disabled || submitting}
          />
        </label>
        <label className="text-sm text-slate-200">
          Clinic Email
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={clinicEmail}
            onChange={(e) => setClinicEmail(e.target.value)}
            placeholder="clinic@yourpractice.com"
            disabled={disabled || submitting}
          />
        </label>
        <label className="text-sm text-slate-200">
          Doctor Email
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={doctorEmail}
            onChange={(e) => setDoctorEmail(e.target.value)}
            placeholder="doctor@yourpractice.com"
            disabled={disabled || submitting}
          />
        </label>
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={patientConsent}
          onChange={(e) => setPatientConsent(e.target.checked)}
          disabled={disabled || submitting}
          className="mt-0.5"
        />
        <span>I consent to HairAudit contacting my clinic and/or surgeon for documentation related to this case.</span>
      </label>

      {message && (
        <p className={`mt-3 text-sm ${message.type === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || submitting}
          className="rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Sending..." : "Send Contribution Request"}
        </button>
      </div>
    </section>
  );
}
