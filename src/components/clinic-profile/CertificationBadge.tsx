/**
 * Certification badge (UI only): Active | Silver | Gold | Platinum.
 * Maps VERIFIED → Active; no backend scoring changes.
 */

import type { AwardTier } from "@/lib/transparency/awardRules";

export const CERTIFICATION_LABELS: Record<string, string> = {
  VERIFIED: "Active",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

type CertificationBadgeProps = {
  tier: AwardTier | string | null;
  /** compact: inline badge; full: badge + "Certification" label */
  variant?: "compact" | "full";
  className?: string;
};

export default function CertificationBadge({
  tier,
  variant = "compact",
  className = "",
}: CertificationBadgeProps) {
  const t = (tier ?? "VERIFIED") as AwardTier;
  const label = CERTIFICATION_LABELS[t] ?? CERTIFICATION_LABELS.VERIFIED ?? "Active";

  const isPremium = t === "GOLD" || t === "PLATINUM";

  const badge = (
    <span
      className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-bold ${
        t === "PLATINUM"
          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
          : t === "GOLD"
            ? "bg-amber-500/15 text-amber-200 border border-amber-500/30"
            : t === "SILVER"
              ? "bg-slate-500/20 text-slate-200 border border-slate-500/30"
              : "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30"
      } ${isPremium ? "shadow-lg shadow-amber-500/5" : ""} ${className}`}
      title="Clinic certification level"
    >
      {label}
    </span>
  );

  if (variant === "full") {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Certification
        </span>
        {badge}
      </div>
    );
  }

  return badge;
}
