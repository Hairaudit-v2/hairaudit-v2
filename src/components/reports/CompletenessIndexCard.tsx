"use client";

import React from "react";

type CompletenessIndexV1 = {
  version?: number;
  score?: number;
  weights?: { photos?: number; structured_metadata?: number; numeric_precision?: number; verification_evidence?: number };
  breakdown?: {
    photo_coverage?: { score?: number; base?: number; bonus?: number };
    structured_metadata?: { score?: number; done?: number; total?: number };
    numeric_precision?: { score?: number; done?: number; total?: number };
    verification_evidence?: { score?: number };
  };
};

function band(score: number) {
  if (score >= 85) return { cls: "bg-emerald-50 border-emerald-200 text-emerald-800", label: "High" };
  if (score >= 70) return { cls: "bg-green-50 border-green-200 text-green-800", label: "Good" };
  if (score >= 55) return { cls: "bg-amber-50 border-amber-200 text-amber-800", label: "Moderate" };
  return { cls: "bg-rose-50 border-rose-200 text-rose-800", label: "Low" };
}

export default function CompletenessIndexCard({ ci }: { ci: CompletenessIndexV1 | null | undefined }) {
  if (!ci) return null;
  const score = Math.max(0, Math.min(100, Math.round(Number(ci.score ?? 0))));
  const b = band(score);

  const photo = Number(ci.breakdown?.photo_coverage?.score ?? 0);
  const structured = Number(ci.breakdown?.structured_metadata?.score ?? 0);
  const numeric = Number(ci.breakdown?.numeric_precision?.score ?? 0);
  const verification = Number(ci.breakdown?.verification_evidence?.score ?? 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Completeness Index (v1)</h3>
          <p className="mt-1 text-sm text-slate-600">
            Documentation completeness score based on submitted doctor photos + structured metadata + precision fields.
          </p>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-sm ${b.cls}`}>
          <div className="font-semibold">{score}/100</div>
          <div className="text-xs">{b.label}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-semibold text-slate-500">Photos (0–45)</div>
          <div className="text-lg font-bold text-slate-900">{Math.round(photo)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-semibold text-slate-500">Structured (0–35)</div>
          <div className="text-lg font-bold text-slate-900">{Math.round(structured)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-semibold text-slate-500">Numeric (0–10)</div>
          <div className="text-lg font-bold text-slate-900">{Math.round(numeric)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-semibold text-slate-500">Verification (0–10)</div>
          <div className="text-lg font-bold text-slate-900">{Math.round(verification)}</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Based on submitted documentation.
      </div>
    </div>
  );
}

