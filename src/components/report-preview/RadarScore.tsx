type RadarScoreProps = {
  evidenceScore?: number;
  values?: number[];
};

const categories = [
  "Donor Management",
  "Extraction Technique",
  "Graft Handling",
  "Implantation Quality",
  "Hairline Design",
];

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = (Math.PI / 180) * angleDeg;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function polygonPoints(values: number[], radius: number, cx: number, cy: number) {
  return values
    .map((v, i) => {
      const normalized = Math.max(0, Math.min(100, v)) / 100;
      const angle = -90 + i * (360 / values.length);
      const point = polarToCartesian(cx, cy, radius * normalized, angle);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

export default function RadarScore({
  evidenceScore = 78,
  values = [80, 72, 68, 76, 74],
}: RadarScoreProps) {
  const cx = 120;
  const cy = 120;
  const radius = 86;
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Domain radar
      </p>
      <div className="mt-5 flex justify-center">
        <svg viewBox="0 0 240 240" className="w-full max-w-[260px]" aria-label="Audit radar score preview">
          {rings.map((ring) => {
            const points = categories
              .map((_, i) => {
                const angle = -90 + i * (360 / categories.length);
                const point = polarToCartesian(cx, cy, radius * ring, angle);
                return `${point.x},${point.y}`;
              })
              .join(" ");
            return (
              <polygon
                key={ring}
                points={points}
                fill="none"
                stroke="rgba(148,163,184,0.35)"
                strokeWidth="1"
              />
            );
          })}

          {categories.map((_, i) => {
            const angle = -90 + i * (360 / categories.length);
            const point = polarToCartesian(cx, cy, radius, angle);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={point.x}
                y2={point.y}
                stroke="rgba(148,163,184,0.25)"
                strokeWidth="1"
              />
            );
          })}

          <polygon
            points={polygonPoints(values, radius, cx, cy)}
            fill="rgba(245,158,11,0.25)"
            stroke="rgba(251,191,36,0.9)"
            strokeWidth="2"
          />
          <circle cx={cx} cy={cy} r="2.5" fill="rgba(251,191,36,0.9)" />
        </svg>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map((category, i) => (
          <div key={category} className="text-xs text-slate-400">
            <span className="text-slate-300">{category}</span>
            <span className="ml-2 text-amber-400 font-medium">{values[i]}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Evidence score</p>
        <p className="mt-1 text-2xl font-bold text-white">{evidenceScore}</p>
        <p className="text-xs text-slate-400">Documentation sufficiency and audit defensibility</p>
      </div>
    </div>
  );
}
