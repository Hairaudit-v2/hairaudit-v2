"use client";

import type { PatientImageEvidenceUploadNudge } from "@/lib/audit/patientImageEvidenceUploadNudges";

/** Informational-only suggestions; must not gate submit or required flow. */
export default function PatientImageEvidenceNudgeCallout({
  nudges,
  variant = "patient",
}: {
  nudges: PatientImageEvidenceUploadNudge[];
  /** `auditor` uses darker chrome to match case review panels */
  variant?: "patient" | "auditor";
}) {
  if (!nudges.length) return null;

  const box =
    variant === "auditor"
      ? "rounded-lg border border-slate-800/90 bg-slate-950/35 px-3 py-3 text-xs text-slate-400"
      : "rounded-lg border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-700";

  const titleCls =
    variant === "auditor"
      ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
      : "text-xs font-semibold uppercase tracking-wide text-slate-500";

  const disclaimerCls = variant === "auditor" ? "mt-1 text-[11px] text-slate-500" : "mt-1 text-xs text-slate-500";

  const ulCls = variant === "auditor" ? "mt-2 list-disc space-y-1.5 pl-4" : "mt-3 list-disc space-y-2 pl-5";

  const strongCls = variant === "auditor" ? "font-medium text-slate-300" : "font-medium text-slate-800";

  return (
    <aside className={box} aria-label="Optional photo suggestions">
      <h2 className={titleCls}>Optional ideas to strengthen your evidence</h2>
      <p className={disclaimerCls}>
        Informational only — not required to submit and does not change your eligibility or scores.
      </p>
      <ul className={ulCls}>
        {nudges.map((n) => (
          <li key={n.groupId}>
            <span className={strongCls}>{n.areaLabel}:</span> {n.recommendation}
          </li>
        ))}
      </ul>
    </aside>
  );
}
