import type { ReactNode } from "react";

type Tone = "cyan" | "slate" | "amber";

const toneClasses: Record<Tone, { wrap: string; label: string }> = {
  cyan: {
    wrap: "border-cyan-500/25 bg-cyan-500/[0.06]",
    label: "text-cyan-200/90",
  },
  slate: {
    wrap: "border-white/10 bg-white/[0.03]",
    label: "text-slate-400",
  },
  amber: {
    wrap: "border-amber-300/25 bg-amber-500/[0.06]",
    label: "text-amber-200/90",
  },
};

export function GeoShortAnswer({
  children,
  title = "Short answer",
  tone = "cyan",
}: {
  children: ReactNode;
  title?: string;
  tone?: Tone;
}) {
  const t = toneClasses[tone];
  return (
    <div
      className={`mt-6 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 ${t.wrap}`}
      role="region"
      aria-label={title}
    >
      <p className={`text-xs font-semibold uppercase tracking-wider ${t.label}`}>{title}</p>
      <div className="mt-2 text-slate-200 leading-relaxed text-[15px] sm:text-base">{children}</div>
    </div>
  );
}

export function GeoKeyTakeaways({
  items,
  title = "Key takeaways",
  tone = "slate",
}: {
  items: string[];
  title?: string;
  tone?: Tone;
}) {
  if (items.length === 0) return null;
  const t = toneClasses[tone];
  return (
    <div
      className={`mt-6 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 ${t.wrap}`}
      role="region"
      aria-label={title}
    >
      <p className={`text-xs font-semibold uppercase tracking-wider ${t.label}`}>{title}</p>
      <ul className="mt-3 space-y-2 text-slate-300 leading-relaxed">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-amber-400 shrink-0">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GeoContextLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-2 text-sm sm:text-[15px] text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

export function GeoPhotosCannotConfirm({
  items,
  title = "What photos alone cannot confirm",
}: {
  items: string[];
  title?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="mt-5 rounded-xl border border-slate-600/40 bg-slate-950/50 px-4 py-4 sm:px-5 sm:py-5"
      role="region"
      aria-label={title}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="mt-3 space-y-2 text-slate-400 text-sm leading-relaxed">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-slate-500 shrink-0">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
