type ClinicMetricCardProps = {
  label: string;
  value: string | number;
  sub?: string | null;
  /** When true, show a subtle placeholder style (e.g. "—" for missing data) */
  placeholder?: boolean;
};

export default function ClinicMetricCard({ label, value, sub, placeholder }: ClinicMetricCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums ${
          placeholder ? "text-slate-500" : "text-white"
        }`}
      >
        {value}
      </p>
      {sub != null && sub !== "" && (
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      )}
    </div>
  );
}
