type ClinicMetricCardProps = {
  label: string;
  value: string | number;
  sub?: string | null;
  /** When true, show a subtle placeholder style (e.g. "—" for missing data) */
  placeholder?: boolean;
};

export default function ClinicMetricCard({ label, value, sub, placeholder }: ClinicMetricCardProps) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-fi-panel">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums ${
          placeholder ? "text-muted-foreground/60" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub != null && sub !== "" && (
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
