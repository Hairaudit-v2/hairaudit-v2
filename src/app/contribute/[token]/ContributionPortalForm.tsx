"use client";

import { useState } from "react";

type Props = {
  token: string;
  caseId: string;
  clinicName?: string | null;
  doctorName?: string | null;
};

export default function ContributionPortalForm({ token, caseId, clinicName, doctorName }: Props) {
  const [planningDetails, setPlanningDetails] = useState("");
  const [donorMappingDetails, setDonorMappingDetails] = useState("");
  const [graftHandlingDetails, setGraftHandlingDetails] = useState("");
  const [implantationDetails, setImplantationDetails] = useState("");
  const [verificationFields, setVerificationFields] = useState("");
  const [optionalImages, setOptionalImages] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const onSubmit = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/contribution-portal/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          planningDetails,
          donorMappingDetails,
          graftHandlingDetails,
          implantationDetails,
          verificationFields,
          optionalImages: optionalImages
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to submit contribution.");
      setMessage({
        type: "ok",
        text: "Contribution submitted. HairAudit will include this documentation in the case review recalculation.",
      });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? "Unable to submit contribution." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Clinic/Doctor Contribution Portal</h1>
      <p className="mt-2 text-sm text-slate-600">
        Provide documentation to support a fair, complete, and transparent forensic review.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Case: {caseId} {clinicName ? `| Clinic: ${clinicName}` : ""} {doctorName ? `| Doctor: ${doctorName}` : ""}
      </p>

      <div className="mt-6 space-y-4">
        <label className="block text-sm text-slate-700">
          Planning details
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={4}
            value={planningDetails}
            onChange={(e) => setPlanningDetails(e.target.value)}
          />
        </label>

        <label className="block text-sm text-slate-700">
          Donor mapping details
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={4}
            value={donorMappingDetails}
            onChange={(e) => setDonorMappingDetails(e.target.value)}
          />
        </label>

        <label className="block text-sm text-slate-700">
          Graft handling details
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={4}
            value={graftHandlingDetails}
            onChange={(e) => setGraftHandlingDetails(e.target.value)}
          />
        </label>

        <label className="block text-sm text-slate-700">
          Implantation details
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={4}
            value={implantationDetails}
            onChange={(e) => setImplantationDetails(e.target.value)}
          />
        </label>

        <label className="block text-sm text-slate-700">
          Verification fields
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={4}
            value={verificationFields}
            onChange={(e) => setVerificationFields(e.target.value)}
            placeholder="Include any verification notes, logs, cross-check references, and timestamps."
          />
        </label>

        <label className="block text-sm text-slate-700">
          Optional intra-op/day0 images (one URL/path per line)
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={4}
            value={optionalImages}
            onChange={(e) => setOptionalImages(e.target.value)}
          />
        </label>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.type === "ok" ? "text-emerald-700" : "text-rose-700"}`}>{message.text}</p>
      )}

      <div className="mt-6">
        <button
          onClick={onSubmit}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Contribution"}
        </button>
      </div>
    </div>
  );
}
