"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { caseSubmitSurfaceOpen } from "@/lib/patient/caseSubmitStatus";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import { trackDonorCaseSubmittedOnce } from "@/lib/analytics/donorFunnelEvents";
import { isDonorHealingEntryContext } from "@/lib/patient/donorHealingEntry";

export default function SubmitButton({
  caseId,
  caseStatus,
  submittedAt,
  compact = false,
  patientReviewPathway = null,
  submitLabel,
  resubmitLabel,
  whatHappensNext: whatHappensNextOverride,
  donorEntryContext = null,
}: {
  caseId: string;
  caseStatus: string;
  submittedAt?: string | null;
  compact?: boolean;
  patientReviewPathway?: PatientReviewPathway | null;
  submitLabel?: string;
  resubmitLabel?: string;
  whatHappensNext?: string;
  /** HA-DONOR-HEALING-1B — when set, emit donor_case_submitted after successful submit. */
  donorEntryContext?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const locked = !caseSubmitSurfaceOpen({ status: caseStatus, submitted_at: submittedAt });
  const isResubmit = caseStatus === "audit_failed";
  const isPre = patientReviewPathway === "pre_surgery";

  const buttonLabel = locked
    ? "Already submitted"
    : busy
      ? "Submitting…"
      : isResubmit
        ? (resubmitLabel ?? (isPre ? "Resubmit Pre-Surgery Review" : "Resubmit for audit"))
        : (submitLabel ?? (isPre ? "Submit Pre-Surgery Review" : "Submit for audit"));

  const nextCopy =
    whatHappensNextOverride ??
    (isPre
      ? "Once you submit, specialists will prepare your independent planning review. We will notify you by email when your Pre-Surgery Review Report is ready."
      : "Once you submit your case, our system will process your audit. When your report is ready, we'll notify you by email and make it available in your dashboard.");

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error ?? `Submit failed (${res.status})`);

      if (isDonorHealingEntryContext(donorEntryContext)) {
        trackDonorCaseSubmittedOnce(caseId);
      }

      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const whatHappensNext = (
    <div
      className={
        compact
          ? "mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
          : "mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
      }
    >
      <p className={`font-medium ${compact ? "text-xs text-slate-300/90" : "text-sm text-slate-700"}`}>
        What happens next
      </p>
      <p className={`mt-1 ${compact ? "text-xs text-slate-200/80 leading-relaxed" : "text-sm text-slate-600 leading-relaxed"}`}>
        {nextCopy}
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-sm text-gray-600">
          {isPre
            ? "Submit this case to start your Pre-Surgery Review. A planning report will be prepared asynchronously."
            : "Submit this case to trigger the audit. A report will be generated asynchronously."}
        </p>
      )}
      <button
        onClick={submit}
        disabled={busy || locked}
        className="rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-60 bg-amber-500 text-slate-900 hover:bg-amber-400"
      >
        {buttonLabel}
      </button>

      {!compact && submittedAt && (
        <div className="text-sm text-gray-600">
          Submitted {new Date(submittedAt).toLocaleString()}
        </div>
      )}

      {!locked && whatHappensNext}

      {err && <p className="text-sm text-red-600">❌ {err}</p>}
    </div>
  );
}
