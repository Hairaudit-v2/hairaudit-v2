import type { AuditPriorityBreakdown } from "@/lib/dashboard/auditOperations/types";

const PRIORITY_LABELS: Array<{ key: keyof AuditPriorityBreakdown; label: string; tone: string }> = [
  { key: "overdue", label: "Overdue", tone: "bg-rose-500" },
  { key: "lowConfidence", label: "Low Confidence", tone: "bg-amber-500" },
  { key: "evidencePoor", label: "Evidence Poor", tone: "bg-orange-500" },
  { key: "manualReview", label: "Manual Review", tone: "bg-indigo-500" },
];

export default function AuditPriorityChart({ breakdown }: { breakdown: AuditPriorityBreakdown }) {
  const maxValue = Math.max(...PRIORITY_LABELS.map((s) => breakdown[s.key]), 1);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Priority Backlog</h3>
      <p className="mb-4 text-xs text-slate-500">Overdue and risk-heavy cases needing intervention.</p>
      <div className="space-y-2">
        {PRIORITY_LABELS.map((item) => {
          const value = breakdown[item.key];
          const width = Math.max(4, Math.round((value / maxValue) * 100));
          return (
            <div key={item.key} className="grid grid-cols-[120px_1fr_42px] items-center gap-2">
              <div className="text-xs text-slate-600">{item.label}</div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${item.tone}`} style={{ width: `${width}%` }} />
              </div>
              <div className="text-right text-xs font-medium text-slate-700">{value}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
