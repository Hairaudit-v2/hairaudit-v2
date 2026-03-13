import type { AuditVolumePoint } from "@/lib/dashboard/auditOperations/types";

function buildPath(values: number[], height: number, width: number) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / spread) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function LineChart({
  title,
  valuesA,
  valuesB,
  colorA,
  colorB,
  legendA,
  legendB,
  labels,
}: {
  title: string;
  valuesA: number[];
  valuesB?: number[];
  colorA: string;
  colorB?: string;
  legendA: string;
  legendB?: string;
  labels: string[];
}) {
  const allValues = valuesB ? [...valuesA, ...valuesB] : valuesA;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const normalizedA = valuesA.map((v) => (v - min) / Math.max(1, max - min));
  const normalizedB = valuesB?.map((v) => (v - min) / Math.max(1, max - min));
  const pathA = buildPath(normalizedA, 86, 420);
  const pathB = normalizedB ? buildPath(normalizedB, 86, 420) : "";
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-xs font-semibold text-slate-700">{title}</div>
      <svg viewBox="0 0 420 92" className="h-28 w-full">
        <path d={pathA} fill="none" className={`${colorA} stroke-2`} />
        {pathB ? <path d={pathB} fill="none" className={`${colorB} stroke-2`} /> : null}
      </svg>
      <div className="mt-1 flex gap-3 text-[10px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${colorA.replace("stroke-", "bg-")}`} />
          {legendA}
        </span>
        {legendB && colorB ? (
          <span className="inline-flex items-center gap-1">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${colorB.replace("stroke-", "bg-")}`} />
            {legendB}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{labels[0] ?? ""}</span>
        <span>{labels[labels.length - 1] ?? ""}</span>
      </div>
    </div>
  );
}

export default function AuditVolumeChart({ points }: { points: AuditVolumePoint[] }) {
  const labels = points.map((p) => p.label);
  const newAudits = points.map((p) => p.newAudits);
  const completedAudits = points.map((p) => p.completedAudits);
  const totalVolume = points.map((p) => p.totalVolume);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Audit Volume Trends</h3>
        <p className="text-xs text-slate-500">New vs completed audits and cumulative volume over time.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <LineChart
          title="New Audits vs Completed Audits"
          valuesA={newAudits}
          valuesB={completedAudits}
          colorA="stroke-sky-500"
          colorB="stroke-emerald-500"
          legendA="New"
          legendB="Completed"
          labels={labels}
        />
        <LineChart title="Total Audit Volume" valuesA={totalVolume} colorA="stroke-violet-500" legendA="Total Volume" labels={labels} />
      </div>
    </section>
  );
}
