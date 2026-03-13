import type { AuditStatusBreakdown } from "@/lib/dashboard/auditOperations/types";

const STATUS_LABELS: Array<{ key: keyof AuditStatusBreakdown; label: string }> = [
  { key: "submitted", label: "Submitted" },
  { key: "processing", label: "Processing" },
  { key: "inReview", label: "In Review" },
  { key: "complete", label: "Complete" },
  { key: "auditFailed", label: "Failed" },
];

export default function AuditStatusChart({ breakdown }: { breakdown: AuditStatusBreakdown }) {
  const maxValue = Math.max(...STATUS_LABELS.map((s) => breakdown[s.key]), 1);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Audit Status Pipeline</h3>
      <p className="mb-4 text-xs text-slate-500">Current pipeline distribution by status.</p>
      <div className="space-y-2">
        {STATUS_LABELS.map((status) => {
          const value = breakdown[status.key];
          const width = Math.max(4, Math.round((value / maxValue) * 100));
          return (
            <div key={status.key} className="grid grid-cols-[120px_1fr_42px] items-center gap-2">
              <div className="text-xs text-slate-600">{status.label}</div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-sky-500" style={{ width: `${width}%` }} />
              </div>
              <div className="text-right text-xs font-medium text-slate-700">{value}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
