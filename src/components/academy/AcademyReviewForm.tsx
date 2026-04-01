"use client";

import { useState } from "react";
import { ACADEMY_DOMAIN_LABELS, ACADEMY_SCORING_DOMAINS } from "@/lib/academy/constants";

export default function AcademyReviewForm({ caseId, defaultStage }: { caseId: string; defaultStage: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const domain_scores_json: Record<string, number> = {};
    for (const key of ACADEMY_SCORING_DOMAINS) {
      const raw = String(fd.get(`d_${key}`) ?? "").trim();
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isFinite(n)) domain_scores_json[key] = n;
    }
    const body = {
      stage_at_assessment: String(fd.get("stage_at_assessment") || "").trim() || defaultStage,
      domain_scores_json,
      strengths: String(fd.get("strengths") || "").trim() || null,
      weaknesses: String(fd.get("weaknesses") || "").trim() || null,
      corrective_actions: String(fd.get("corrective_actions") || "").trim() || null,
      ready_to_progress: fd.get("ready_to_progress") === "on",
      trainer_confidence: Number(fd.get("trainer_confidence") || "") || null,
      overall_score: Number(fd.get("overall_score") || "") || null,
      signed_off_at: fd.get("signed_off") === "on" ? new Date().toISOString() : null,
    };
    try {
      const res = await fetch(`/api/academy/cases/${caseId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");

      await fetch(`/api/academy/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      });

      setMsg("Assessment saved and case marked reviewed.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600">Stage at assessment</label>
        <input
          name="stage_at_assessment"
          defaultValue={defaultStage}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        <div className="text-xs font-semibold text-slate-700">Domains (0–5)</div>
        {ACADEMY_SCORING_DOMAINS.map((key) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-slate-700 truncate" title={ACADEMY_DOMAIN_LABELS[key]}>
              {ACADEMY_DOMAIN_LABELS[key]}
            </span>
            <input
              name={`d_${key}`}
              type="number"
              min={0}
              max={5}
              step={0.5}
              className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">Strengths</label>
        <textarea name="strengths" rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Weaknesses</label>
        <textarea name="weaknesses" rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Corrective actions</label>
        <textarea
          name="corrective_actions"
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600">Trainer confidence (1–5)</label>
          <input
            name="trainer_confidence"
            type="number"
            min={1}
            max={5}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Overall score (0–5)</label>
          <input
            name="overall_score"
            type="number"
            min={0}
            max={5}
            step={0.1}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="ready_to_progress" />
        Ready to progress
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="signed_off" />
        Sign off now
      </label>

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Submit assessment"}
      </button>
      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </form>
  );
}
