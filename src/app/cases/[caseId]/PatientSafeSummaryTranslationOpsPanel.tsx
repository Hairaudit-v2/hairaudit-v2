"use client";

import { useEffect, useState } from "react";

type OpsState = {
  pilotEnabled: boolean;
  requestedLocale: string;
  targetLocale: string | null;
  hasStoredTranslation: boolean;
  translationStatus: string;
  reviewStatus: string;
  serveDecision: string;
  fallbackReason?: string;
  translationProvenance?: string;
  translatedAt?: string | null;
  reviewedAt?: string | null;
  reviewerId?: string | null;
  reviewNotes?: string | null;
  lastReviewAction?: "approved" | "rejected" | "reset_review" | null;
  lastReviewActionAt?: string | null;
  lastReviewActionBy?: string | null;
};

export default function PatientSafeSummaryTranslationOpsPanel({ caseId, locale }: { caseId: string; locale: string }) {
  const [state, setState] = useState<OpsState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  async function load() {
    setError(null);
    const res = await fetch(
      `/api/auditor/patient-safe-summary-translation?caseId=${encodeURIComponent(caseId)}&locale=${encodeURIComponent(locale)}`,
      { cache: "no-store" }
    );
    const data = (await res.json().catch(() => null)) as { ok?: boolean; state?: OpsState; error?: string } | null;
    if (!res.ok || !data?.ok || !data.state) {
      setError(data?.error ?? "Could not load translation pilot state.");
      return;
    }
    setState(data.state);
  }

  async function act(action: "refresh" | "approve" | "reject" | "reset_review") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/auditor/patient-safe-summary-translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, locale, action, reviewNotes: reviewNote }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? `Could not run ${action}.`);
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, locale]);

  return (
    <section className="mt-6 rounded-2xl border border-violet-300/25 bg-violet-950/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-violet-100">Patient-safe summary translation pilot ops</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-violet-300/30 px-2.5 py-1 text-xs font-medium text-violet-100 hover:bg-violet-300/10"
          disabled={busy != null}
        >
          Refresh status
        </button>
      </div>

      {state ? (
        <dl className="mt-3 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
          <div><dt className="text-slate-400">Pilot enabled</dt><dd>{String(state.pilotEnabled)}</dd></div>
          <div><dt className="text-slate-400">Requested locale</dt><dd>{state.requestedLocale}</dd></div>
          <div><dt className="text-slate-400">Stored translation</dt><dd>{String(state.hasStoredTranslation)}</dd></div>
          <div><dt className="text-slate-400">Translation status</dt><dd>{state.translationStatus}</dd></div>
          <div><dt className="text-slate-400">Review status</dt><dd>{state.reviewStatus}</dd></div>
          <div><dt className="text-slate-400">Serve decision</dt><dd>{state.serveDecision}</dd></div>
          <div><dt className="text-slate-400">Fallback reason</dt><dd>{state.fallbackReason ?? "n/a"}</dd></div>
          <div><dt className="text-slate-400">Provenance</dt><dd className="truncate">{state.translationProvenance ?? "n/a"}</dd></div>
        </dl>
      ) : (
        <p className="mt-3 text-xs text-slate-300/80">Loading translation pilot state…</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void act("refresh")}
          disabled={busy != null}
          className="rounded-lg border border-cyan-300/30 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-60"
        >
          {busy === "refresh" ? "Refreshing…" : "Regenerate translation"}
        </button>
        <button
          type="button"
          onClick={() => void act("approve")}
          disabled={busy != null}
          className="rounded-lg border border-emerald-300/30 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-300/10 disabled:opacity-60"
        >
          {busy === "approve" ? "Saving…" : "Mark approved"}
        </button>
        <button
          type="button"
          onClick={() => void act("reject")}
          disabled={busy != null}
          className="rounded-lg border border-rose-300/30 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-300/10 disabled:opacity-60"
        >
          {busy === "reject" ? "Saving…" : "Mark rejected"}
        </button>
        <button
          type="button"
          onClick={() => void act("reset_review")}
          disabled={busy != null}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/10 disabled:opacity-60"
        >
          {busy === "reset_review" ? "Saving…" : "Reset review"}
        </button>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs text-slate-300">Review note (required for rejection)</label>
        <textarea
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-white/20 bg-slate-950/50 px-2.5 py-2 text-xs text-slate-100"
          placeholder="Add rationale for approval/rejection/reset."
          disabled={busy != null}
        />
      </div>

      {state ? (
        <dl className="mt-3 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
          <div><dt className="text-slate-400">Reviewed at</dt><dd>{state.reviewedAt ?? "n/a"}</dd></div>
          <div><dt className="text-slate-400">Reviewer</dt><dd>{state.reviewerId ?? "n/a"}</dd></div>
          <div><dt className="text-slate-400">Last action</dt><dd>{state.lastReviewAction ?? "n/a"}</dd></div>
          <div><dt className="text-slate-400">Last action at</dt><dd>{state.lastReviewActionAt ?? "n/a"}</dd></div>
          <div className="sm:col-span-2">
            <dt className="text-slate-400">Review note</dt>
            <dd className="whitespace-pre-wrap">{state.reviewNotes ?? "n/a"}</dd>
          </div>
        </dl>
      ) : null}

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
