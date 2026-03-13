import type { OperationalAuditRow } from "@/lib/dashboard/auditOperations/types";

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function OperationalAuditsTable({ title, rows }: { title: string; rows: OperationalAuditRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{rows.length} audit(s)</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-500">No audits found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Case ID</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Evidence</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 text-sm text-slate-700">
                  <td className="px-3 py-3 font-mono text-xs">{row.id.slice(0, 8)}…</td>
                  <td className="px-3 py-3">{row.title}</td>
                  <td className="px-3 py-3 capitalize">{row.auditType}</td>
                  <td className="px-3 py-3">{row.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-3">{typeof row.confidence === "number" ? `${Math.round(row.confidence * 100)}%` : "—"}</td>
                  <td className="px-3 py-3">{typeof row.evidenceScore === "number" ? Math.round(row.evidenceScore) : "—"}</td>
                  <td className="px-3 py-3">{formatDate(row.updatedAt)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
