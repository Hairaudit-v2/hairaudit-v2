import type { AuditKpi } from "@/lib/dashboard/auditOperations/types";

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export default function AuditKpiCards({ kpis }: { kpis: AuditKpi }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="New Audits Today" value={String(kpis.newAuditsToday)} />
      <KpiCard label="Total Open Audits" value={String(kpis.totalOpenAudits)} />
      <KpiCard label="Completed Today" value={String(kpis.completedToday)} />
      <KpiCard label="Manual Review Queue" value={String(kpis.manualReviewQueue)} />
      <KpiCard label="Overdue Audits" value={String(kpis.overdueAudits)} />
      <KpiCard label="Average Turnaround Time" value={`${kpis.averageTurnaroundHours}h`} hint="Average from submission to completion" />
      <KpiCard label="Low Confidence Cases" value={String(kpis.lowConfidenceCases)} />
    </section>
  );
}
