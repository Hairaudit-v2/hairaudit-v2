"use client";

import type { TrainingCaseCorrectionRow } from "@/lib/academy/types";

const TYPE_LABELS: Record<string, string> = {
  case_details_update: "Case details",
  metrics_update: "Surgical metrics",
  upload_category_update: "Image category",
  upload_delete: "Image removed",
  case_archived: "Archived",
  case_voided: "Voided",
  case_restored: "Restored",
  case_deleted: "Deleted",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      return s.length > 120 ? `${s.slice(0, 117)}…` : s;
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export default function TrainingCaseCorrectionHistory({
  corrections,
  userNamesById,
}: {
  corrections: TrainingCaseCorrectionRow[];
  userNamesById: Record<string, string>;
}) {
  if (!corrections.length) {
    return <p className="text-sm text-slate-500">No corrections recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold">When</th>
            <th className="px-3 py-2 font-semibold">User</th>
            <th className="px-3 py-2 font-semibold">Type</th>
            <th className="px-3 py-2 font-semibold">Field</th>
            <th className="px-3 py-2 font-semibold">Previous</th>
            <th className="px-3 py-2 font-semibold">New</th>
            <th className="px-3 py-2 font-semibold">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {corrections.map((c) => (
            <tr key={c.id} className="text-slate-700">
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{new Date(c.created_at).toLocaleString()}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {c.changed_by ? (userNamesById[c.changed_by] ?? c.changed_by.slice(0, 8)) : "—"}
              </td>
              <td className="px-3 py-2">{TYPE_LABELS[c.correction_type] ?? c.correction_type}</td>
              <td className="px-3 py-2 font-mono text-[11px]">{c.field_name ?? "—"}</td>
              <td className="px-3 py-2 max-w-[140px] truncate font-mono text-[11px]" title={formatValue(c.old_value)}>
                {formatValue(c.old_value)}
              </td>
              <td className="px-3 py-2 max-w-[140px] truncate font-mono text-[11px]" title={formatValue(c.new_value)}>
                {formatValue(c.new_value)}
              </td>
              <td className="px-3 py-2 max-w-[200px] text-slate-600">{c.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
