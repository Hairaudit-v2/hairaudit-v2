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
  spacing = "default",
}: {
  children: ReactNode;
  title?: string;
  tone?: Tone;
  /** tight: less top margin when stacked under intro (issue pages). */
  spacing?: "default" | "tight";
}) {
  const t = toneClasses[tone];
  const mt = spacing === "tight" ? "mt-4 sm:mt-5" : "mt-6";
  return (
    <div
      className={`${mt} rounded-xl border px-4 py-4 sm:px-5 sm:py-5 ${t.wrap}`}
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
  spacing = "default",
}: {
  items: string[];
  title?: string;
  tone?: Tone;
  spacing?: "default" | "tight";
}) {
  if (items.length === 0) return null;
  const t = toneClasses[tone];
  const mt = spacing === "tight" ? "mt-4 sm:mt-5" : "mt-6";
  return (
    <div
      className={`${mt} rounded-xl border px-4 py-4 sm:px-5 sm:py-5 ${t.wrap}`}
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
  variant = "card",
}: {
  label: string;
  children: ReactNode;
  /** inline: lighter weight for issue landings so the stack does not feel like three cards. */
  variant?: "card" | "inline";
}) {
  if (variant === "inline") {
    return (
      <div className="mt-4 border-l-2 border-amber-500/25 pl-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className="mt-1.5 text-sm text-slate-400 leading-relaxed">{children}</div>
      </div>
    );
  }
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
  density = "default",
}: {
  items: string[];
  title?: string;
  density?: "default" | "compact";
}) {
  if (items.length === 0) return null;
  const pad = density === "compact" ? "px-4 py-3 sm:px-4 sm:py-3.5" : "px-4 py-4 sm:px-5 sm:py-5";
  const mt = density === "compact" ? "mt-4" : "mt-5";
  return (
    <div
      className={`${mt} rounded-xl border border-slate-600/40 bg-slate-950/50 ${pad}`}
      role="region"
      aria-label={title}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <ul
        className={`mt-2.5 space-y-1.5 text-slate-400 leading-relaxed ${density === "compact" ? "text-[13px]" : "text-sm"}`}
      >
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
