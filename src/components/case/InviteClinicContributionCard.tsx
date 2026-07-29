"use client";

import { useMemo, useState } from "react";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

type Props = {
  caseId: string;
  disabled?: boolean;
  defaultClinicName?: string;
  defaultDoctorName?: string;
  patientReviewPathway?: PatientReviewPathway | null;
  title?: string;
  body?: string;
  /** Pre-surgery: section is optional and must not block submission. */
  allowSkip?: boolean;
};

export default function InviteClinicContributionCard({
  caseId,
  disabled = false,
  defaultClinicName = "",
  defaultDoctorName = "",
  patientReviewPathway = null,
  title,
  body,
  allowSkip = false,
}: Props) {
  const isPre = patientReviewPathway === "pre_surgery";
  const [clinicName, setClinicName] = useState(defaultClinicName);
  const [doctorName, setDoctorName] = useState(defaultDoctorName);
  const [clinicEmail, setClinicEmail] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [patientConsent, setPatientConsent] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const heading =
    title ??
    (isPre ? "Add a Clinic Quote or Treatment Plan" : "Invite Clinic Contribution");
  const description =
    body ??
    (isPre
      ? "Optionally upload a quote or proposed treatment plan, or invite a clinic to share proposed technique, graft estimate, surgeon, and treatment details. You can skip this section — it does not block submission."
      : "Allow HairAudit to contact your clinic or surgeon to request procedural documentation for a more complete independent review of your case.");

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
          pathway: patientReviewPathway ?? undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to send contribution request.");
      setMessage({ type: "ok", text: isPre ? "Clinic invite sent." : "Contribution request sent." });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? "Unable to send contribution request." });
    } finally {
      setSubmitting(false);
    }
  };

  if (skipped) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6" data-testid="clinic-contribution-skipped">
        <h2 className="text-lg font-semibold text-white">{heading}</h2>
        <p className="mt-2 text-sm text-slate-300">Skipped — you can add this later without blocking submission.</p>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-cyan-200 hover:text-cyan-100"
          onClick={() => setSkipped(false)}
        >
          Undo skip
        </button>
      </section>
    );
  }

  return (
    <section
      className="mt-6 rounded-2xl border border-cyan-500/30 bg-slate-900 p-6"
      data-testid={isPre ? "pre-surgery-clinic-contribution" : "invite-clinic-contribution"}
    >
      <h2 className="text-lg font-semibold text-white">{heading}</h2>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      {!isPre ? (
        <p className="mt-2 text-xs text-cyan-200/90">
          You can send a contribution request even after your case has been submitted.
        </p>
      ) : (
        <p className="mt-2 text-xs text-cyan-200/90">
          Optional: invite a clinic for proposed technique, graft estimate, surgeon, and treatment details.
        </p>
      )}

      {isPre ? (
        <div className="mt-4">
          <label className="text-sm text-slate-200">
            Upload quote or treatment plan (optional)
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300/20 file:px-3 file:py-1.5 file:text-cyan-100"
              disabled={disabled || submitting}
              onChange={() => {
                setMessage({
                  type: "ok",
                  text: "Attach this file on the photos step under optional clinic quote, or continue with the clinic invite below.",
                });
              }}
            />
          </label>
          <p className="mt-1 text-xs text-slate-400">
            Prefer the photo upload step&apos;s optional clinic-quote slot for a saved copy on your case.
          </p>
        </div>
      ) : null}

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
          {isPre ? "Surgeon / doctor name" : "Doctor Name"}
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder={isPre ? "Proposed treating surgeon" : "Treating doctor name"}
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
        <span>
          {isPre
            ? "I consent to HairAudit contacting this clinic about a proposed treatment plan for my planning review."
            : "I consent to HairAudit contacting my clinic and/or surgeon for documentation related to this case."}
        </span>
      </label>

      {message && (
        <p className={`mt-3 text-sm ${message.type === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || submitting}
          className="rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Sending..." : isPre ? "Invite Clinic" : "Send Contribution Request"}
        </button>
        {(allowSkip || isPre) && (
          <button
            type="button"
            onClick={() => setSkipped(true)}
            disabled={disabled || submitting}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Skip for now
          </button>
        )}
      </div>
    </section>
  );
}
