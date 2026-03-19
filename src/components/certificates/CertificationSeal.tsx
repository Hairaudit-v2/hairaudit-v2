/**
 * Institutional certification seal for Platinum, Gold, and Silver tiers.
 * Clean lines, no gradients or glow. Print-safe. Not used for Verified tier.
 */

export type CertificationSealTier = "silver" | "gold" | "platinum";

type SealStyles = {
  ringStroke: string;
  outerText: string;
  tierText: string;
  centerText: string;
};

const SEAL_STYLES: Record<CertificationSealTier, SealStyles> = {
  silver: {
    ringStroke: "#64748b", // slate-500
    outerText: "#475569", // slate-600
    tierText: "#475569",
    centerText: "#334155", // slate-700
  },
  gold: {
    ringStroke: "#b45309", // amber-700, muted
    outerText: "#92400e", // amber-800
    tierText: "#92400e",
    centerText: "#78350f", // amber-900
  },
  platinum: {
    ringStroke: "#44403c", // stone-700, charcoal
    outerText: "#57534e", // stone-600
    tierText: "#44403c",
    centerText: "#292524", // stone-800
  },
};

type CertificationSealProps = {
  tier: CertificationSealTier;
  className?: string;
};

/** Circular seal: outer ring, HAIRAUDIT CERTIFICATION, tier name, center HA. SVG for crisp print. */
export default function CertificationSeal({ tier, className = "" }: CertificationSealProps) {
  const styles = SEAL_STYLES[tier];
  const tierLabel =
    tier === "platinum" ? "PLATINUM" : tier === "gold" ? "GOLD" : "SILVER";

  return (
    <div
      className={`absolute bottom-16 right-4 sm:right-5 md:right-6 z-[1] w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] md:w-[110px] md:h-[110px] print:w-[100px] print:h-[100px] flex items-center justify-center pointer-events-none select-none ${className}`}
      aria-hidden
      role="img"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer ring */}
        <circle
          cx="50"
          cy="50"
          r="46"
          stroke={styles.ringStroke}
          strokeWidth="1.5"
          fill="none"
        />
        {/* Inner ring */}
        <circle
          cx="50"
          cy="50"
          r="38"
          stroke={styles.ringStroke}
          strokeWidth="0.75"
          fill="none"
        />
        {/* Top line: HAIRAUDIT */}
        <text
          x="50"
          y="28"
          fill={styles.outerText}
          fontSize="4.8"
          fontWeight="600"
          letterSpacing="0.15em"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
        >
          HAIRAUDIT
        </text>
        {/* Second line: CERTIFICATION */}
        <text
          x="50"
          y="35"
          fill={styles.outerText}
          fontSize="3.4"
          fontWeight="500"
          letterSpacing="0.2em"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
        >
          CERTIFICATION
        </text>
        {/* Center: HA */}
        <text
          x="50"
          y="54"
          fill={styles.centerText}
          fontSize="13"
          fontWeight="700"
          letterSpacing="0.06em"
          textAnchor="middle"
          fontFamily="Georgia, serif"
        >
          HA
        </text>
        {/* Tier name */}
        <text
          x="50"
          y="68"
          fill={styles.tierText}
          fontSize="5.5"
          fontWeight="700"
          letterSpacing="0.14em"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
        >
          {tierLabel}
        </text>
      </svg>
    </div>
  );
}
