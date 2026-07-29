"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { patientCaseDashboardPath } from "@/lib/patient/intakeCasePaths";
import { getPatientReviewSubmitCopy } from "@/lib/patient/patientContactCopy";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

export default function PatientReviewSubmitClient({
  caseId,
  pathway,
}: {
  caseId: string;
  pathway: PatientReviewPathway;
}) {
  const router = useRouter();
  const copy = getPatientReviewSubmitCopy(pathway);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const submitRes = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const submitJson = await submitRes.json().catch(() => ({}));
      if (!submitRes.ok) {
        throw new Error(submitJson?.error ?? "Could not submit your review. Please try again.");
      }
      router.push(patientCaseDashboardPath(caseId));
    } catch (err) {
      setError((err as Error)?.message ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8 text-white">
      <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">{copy.progressLabel}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold">{copy.pageTitle}</h1>
        <p className="mt-2 text-sm text-slate-300/80">{copy.supportingText}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {error ? (
            <div role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? copy.primaryBusy : copy.primaryButton}
          </button>
        </form>

        <div className="mt-5 border-t border-white/10 pt-4">
          <Link
            href={`/cases/${caseId}/patient/contact`}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            ← Back to account confirmation
          </Link>
        </div>
      </div>
    </section>
  );
}
