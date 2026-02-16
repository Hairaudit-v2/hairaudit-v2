"use client";

import { useState } from "react";
import Link from "next/link";

export default function ManualAuditFinalize({ caseId }: { caseId: string }) {
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [findings, setFindings] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSave() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/audit/save-manual?caseId=${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: score ? Number(score) : null,
          notes,
          findings: findings.split("\n").filter(Boolean),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      setMsg({ type: "ok", text: "Saved" });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    setMsg(null);
    setBusy(true);
    try {
      const saveRes = await fetch(`/api/audit/save-manual?caseId=${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: score ? Number(score) : null,
          notes,
          findings: findings.split("\n").filter(Boolean),
        }),
      });
      if (!saveRes.ok) {
        const j = await saveRes.json().catch(() => ({}));
        throw new Error(j?.error ?? "Save failed");
      }
      const res = await fetch("/api/audit/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Finalize failed");
      setMsg({ type: "ok", text: "Report finalized. Redirecting…" });
      window.location.href = `/cases/${caseId}`;
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Manual audit</h2>
      <p className="text-sm text-slate-600 mb-4">
        Complete your audit below and finalize to generate the report PDF.
      </p>
      <div className="space-y-4">
        <div>
          <label htmlFor="manual-audit-score" className="block text-sm font-medium text-slate-700 mb-1">Score (0–100)</label>
          <input
            id="manual-audit-score"
            name="score"
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="manual-audit-notes" className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            id="manual-audit-notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="manual-audit-findings" className="block text-sm font-medium text-slate-700 mb-1">Key findings (one per line)</label>
          <textarea
            id="manual-audit-findings"
            name="findings"
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            rows={4}
            placeholder="• Finding 1&#10;• Finding 2"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Link
            href={`/cases/${caseId}`}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 hover:bg-slate-50"
          >
            ← Back to case
          </Link>
          <button
            onClick={handleSave}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-amber-500 text-amber-700 hover:bg-amber-50"
          >
            {busy ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={handleFinalize}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            {busy ? "Processing…" : "Finalize report"}
          </button>
        </div>
        {msg && (
          <p className={`text-sm ${msg.type === "ok" ? "text-amber-600" : "text-red-600"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
