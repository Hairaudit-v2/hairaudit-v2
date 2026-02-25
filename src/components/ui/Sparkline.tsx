type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeClassName?: string;
  fillClassName?: string;
  strokeWidth?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Sparkline({
  values,
  width = 160,
  height = 44,
  className = "",
  strokeClassName = "text-amber-600",
  fillClassName = "text-amber-200/50",
  strokeWidth = 2,
}: SparklineProps) {
  const w = Math.max(20, Math.floor(width));
  const h = Math.max(20, Math.floor(height));
  const padding = 2;

  const safeValues = Array.isArray(values) ? values.map((v) => (Number.isFinite(v) ? Number(v) : 0)) : [];
  const n = safeValues.length;

  if (n === 0) {
    return (
      <div className={`h-[44px] w-[160px] rounded-lg bg-slate-50 border border-slate-100 ${className}`} />
    );
  }

  const maxV = Math.max(...safeValues, 0);
  const denom = maxV <= 0 ? 1 : maxV;

  const xStep = n <= 1 ? 0 : (w - padding * 2) / (n - 1);
  const points = safeValues.map((v, i) => {
    const x = padding + i * xStep;
    const t = clamp(v / denom, 0, 1);
    const y = padding + (1 - t) * (h - padding * 2);
    return { x, y };
  });

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const areaD = `${lineD} L ${(padding + (n - 1) * xStep).toFixed(2)} ${(h - padding).toFixed(
    2
  )} L ${padding.toFixed(2)} ${(h - padding).toFixed(2)} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className={className}
      role="img"
      aria-label="Trend sparkline"
    >
      <path d={areaD} className={`${fillClassName}`} fill="currentColor" stroke="none" />
      <path
        d={lineD}
        className={`${strokeClassName}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

