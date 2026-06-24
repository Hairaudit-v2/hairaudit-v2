"use client";

import { useState } from "react";
import { AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED } from "@/lib/patient/patientPhotoImageLimitedOverride";

type Props = {
  caseId: string;
  missingRequiredPhotoLabels: string[];
  hasPatientImages: boolean;
  hasClinicalHistory: boolean;
};

export default function ImageLimitedRegeneratePanel({
  caseId,
  missingRequiredPhotoLabels,
  hasPatientImages,
  hasClinicalHistory,
}: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canRegenerate = hasPatientImages || hasClinicalHistory;
  const photosMissing = missingRequiredPhotoLabels.length > 0;

  const handleRegenerate = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auditor/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          action: "regenerate_ai_audit",
          reason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
          notes: "Auditor-confirmed image-limited regeneration (missing required patient photos)",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Regeneration failed");
      setSuccess("Image-limited audit regeneration queued.");
      setShowConfirm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!photosMissing) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-5">
      <h3 className="font-semibold text-amber-100">Regenerate as Image-Limited Audit</h3>
      <p className="mt-1 text-sm text-amber-100/80">
        Required patient photos are incomplete. Use this controlled pathway when structured clinical history
        and/or partial images should support an image-limited report.
      </p>

      <dl className="mt-3 space-y-1 text-sm text-slate-200">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-slate-400">Missing required views:</dt>
          <dd>{missingRequiredPhotoLabels.join(", ")}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-slate-400">Patient images present:</dt>
          <dd>{hasPatientImages ? "Yes" : "No"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-slate-400">Structured clinical history:</dt>
          <dd>{hasClinicalHistory ? "Present" : "Not entered"}</dd>
        </div>
      </dl>

      {!canRegenerate && (
        <p className="mt-3 text-sm text-rose-200">
          Add at least one patient image or structured clinical history before using image-limited regeneration.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-300">{success}</p>}

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!canRegenerate}
          className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Regenerate as Image-Limited Audit
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <p className="text-sm text-slate-200">
            Confirm image-limited regeneration. The report will be labelled as image-limited and visual
            assessment confidence will be constrained for missing views. This action is logged.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 bg-emerald-300 hover:bg-emerald-200 disabled:opacity-50"
            >
              {submitting ? "Queueing…" : "Confirm image-limited regeneration"}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 border border-white/15 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
