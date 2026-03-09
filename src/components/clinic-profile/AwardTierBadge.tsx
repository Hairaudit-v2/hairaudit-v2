import type { AwardTier } from "@/lib/transparency/awardRules";

const TIER_LABELS: Record<AwardTier, string> = {
  VERIFIED: "Verified",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

export default function AwardTierBadge({ tier }: { tier: AwardTier | string | null }) {
  const t = (tier ?? "VERIFIED") as AwardTier;
  const label = TIER_LABELS[t] ?? String(tier);

  const isPremium = t === "GOLD" || t === "PLATINUM";

  return (
    <span
      className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-bold ${
        t === "PLATINUM"
          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
          : t === "GOLD"
            ? "bg-amber-500/15 text-amber-200 border border-amber-500/30"
            : t === "SILVER"
              ? "bg-slate-500/20 text-slate-200 border border-slate-500/30"
              : "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30"
      } ${isPremium ? "shadow-lg shadow-amber-500/5" : ""}`}
    >
      {label}
    </span>
  );
}
