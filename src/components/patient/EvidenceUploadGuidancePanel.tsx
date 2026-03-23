"use client";

import { useMemo } from "react";
import type { EvidenceEvaluationResult } from "@/lib/evidence/evidenceEvaluator";
import { EVIDENCE_KEY_DISPLAY_LABELS } from "@/lib/evidence/evidenceMissingCopy";
import type { EvidenceRequirementKey } from "@/lib/evidence/evidenceRequirements";

function distinctMissingLabels(result: EvidenceEvaluationResult): string[] {
  const keys = new Set<EvidenceRequirementKey>();
  for (const m of Object.values(result.metricCoverage)) {
    for (const k of m.missing) keys.add(k);
  }
  return [...keys]
    .map((k) => EVIDENCE_KEY_DISPLAY_LABELS[k] ?? k.replaceAll("_", " "))
    .sort((a, b) => a.localeCompare(b));
}

type Props = {
  result: EvidenceEvaluationResult;
  className?: string;
};

/**
 * Advisory panel: overall evidence completeness % and human-readable missing inputs.
 * Does not gate navigation or submission.
 */
export default function EvidenceUploadGuidancePanel({ result, className = "" }: Props) {
  const labels = useMemo(() => distinctMissingLabels(result), [result]);
  const pct = result.overallCoverageScore;

  return (
    <aside
      className={`rounded-xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-sky-50/50 p-4 text-slate-800 shadow-sm ${className}`}
      role="note"
      aria-label="Evidence guidance"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Evidence completeness</p>
        <span className="text-sm font-bold tabular-nums text-teal-800">{pct}%</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-teal-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      {labels.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-900">To unlock full analysis, upload:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {labels.slice(0, 10).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {labels.length > 10 ? (
            <p className="mt-1 text-xs text-slate-500">+ {labels.length - 10} more suggested views</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-teal-900/90">Required evidence slots for automated analysis look covered.</p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Suggestions only — upload what you can; this does not block your case.
      </p>
    </aside>
  );
}
