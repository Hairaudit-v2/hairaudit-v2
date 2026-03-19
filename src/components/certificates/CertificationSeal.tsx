/**
 * Master certification seal: Platinum, Gold, Silver.
 * Shared SVG geometry, tier palettes, web (subtle effects) vs print (clean) variants.
 * Reusable for certificates, badges, and future PDF. Not used for Verified tier.
 */

export type SealTier = "platinum" | "gold" | "silver";
export type SealVariant = "print" | "web";

/** @deprecated Use SealTier */
export type CertificationSealTier = SealTier;

type CertificationSealProps = {
  tier: SealTier;
  variant?: SealVariant;
  className?: string;
};

const PALETTES: Record<
  SealTier,
  {
    outer: string;
    inner: string;
    text: string;
    accent: string;
    fill: string;
    glow: string;
  }
> = {
  platinum: {
    outer: "#A8ADB4",
    inner: "#6B7280",
    text: "#2B2F36",
    accent: "#C7CCD1",
    fill: "#F5F5F4",
    glow: "#E5E7EB",
  },
  gold: {
    outer: "#B08A3C",
    inner: "#7A5A21",
    text: "#4B3A17",
    accent: "#D6BE7A",
    fill: "#FBF6E8",
    glow: "#F2E6BF",
  },
  silver: {
    outer: "#98A1AC",
    inner: "#6B7280",
    text: "#374151",
    accent: "#D1D5DB",
    fill: "#F7F8FA",
    glow: "#E5E7EB",
  },
};

/**
 * Certification seal SVG: one shared geometry, tier palettes, optional web effects.
 * variant="web": subtle drop shadow + inner glow on core ring.
 * variant="print": no filters, stronger line clarity for PDF/paper.
 */
export function CertificationSeal({
  tier,
  variant = "web",
  className,
}: CertificationSealProps) {
  const palette = PALETTES[tier];
  const tierLabel = tier.toUpperCase();
  const filterId = `sealFilter-${tier}-${variant}`;
  const innerGlowId = `sealInnerGlow-${tier}-${variant}`;

  const useWebEffects = variant === "web";

  return (
    <svg
      viewBox="0 0 1000 1000"
      className={className}
      aria-label={`${tierLabel} HairAudit certification seal`}
      role="img"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <path id={`topArc-${tier}`} d="M 60 500 a 440 440 0 1 1 880 0" />
        <path id={`bottomArc-${tier}`} d="M 940 500 a 440 440 0 1 1 -880 0" />

        {useWebEffects ? (
          <>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="8"
                stdDeviation="10"
                floodColor="#000000"
                floodOpacity="0.10"
              />
            </filter>

            <filter id={innerGlowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.18 0"
                result="softAlpha"
              />
              <feBlend in="SourceGraphic" in2="softAlpha" mode="screen" />
            </filter>
          </>
        ) : null}
      </defs>

      <g filter={useWebEffects ? `url(#${filterId})` : undefined}>
        {/* Base medallion fill */}
        <circle cx="500" cy="500" r="470" fill={palette.fill} />

        {/* Outer boundary */}
        <circle
          cx="500"
          cy="500"
          r="470"
          fill="none"
          stroke={palette.outer}
          strokeWidth="16"
        />

        {/* Outer ring inner line */}
        <circle
          cx="500"
          cy="500"
          r="410"
          fill="none"
          stroke={palette.outer}
          strokeWidth="6"
        />

        {/* Mid prestige ring */}
        <circle
          cx="500"
          cy="500"
          r="335"
          fill="none"
          stroke={palette.inner}
          strokeWidth="8"
        />

        {/* Core boundary */}
        <circle
          cx="500"
          cy="500"
          r="250"
          fill="none"
          stroke={palette.accent}
          strokeWidth="4"
          filter={useWebEffects ? `url(#${innerGlowId})` : undefined}
        />

        {/* Divider dots */}
        <circle cx="112" cy="500" r="16" fill={palette.inner} />
        <circle cx="888" cy="500" r="16" fill={palette.inner} />

        {/* Radial accents */}
        <line
          x1="500"
          y1="157"
          x2="500"
          y2="214"
          stroke={palette.accent}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line
          x1="500"
          y1="786"
          x2="500"
          y2="843"
          stroke={palette.accent}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line
          x1="157"
          y1="500"
          x2="214"
          y2="500"
          stroke={palette.accent}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line
          x1="786"
          y1="500"
          x2="843"
          y2="500"
          stroke={palette.accent}
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Top ring text */}
        <text
          fill={palette.text}
          fontSize="48"
          fontWeight="600"
          letterSpacing="9"
          style={{ textTransform: "uppercase" }}
        >
          <textPath href={`#topArc-${tier}`} startOffset="50%" textAnchor="middle">
            HAIRAUDIT CERTIFICATION
          </textPath>
        </text>

        {/* Bottom ring text */}
        <text
          fill={palette.text}
          fontSize="52"
          fontWeight="700"
          letterSpacing="11"
          style={{ textTransform: "uppercase" }}
        >
          <textPath
            href={`#bottomArc-${tier}`}
            startOffset="50%"
            textAnchor="middle"
          >
            {tierLabel}
          </textPath>
        </text>

        {/* Center field */}
        <circle
          cx="500"
          cy="500"
          r="208"
          fill={useWebEffects ? "#FFFFFF" : palette.fill}
          fillOpacity={useWebEffects ? 0.42 : 0.22}
          stroke="none"
        />

        {/* Center monogram */}
        <text
          x="500"
          y="495"
          fill={palette.text}
          fontSize="168"
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="middle"
          letterSpacing="6"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          HA
        </text>

        {/* Underline */}
        <line
          x1="390"
          y1="610"
          x2="610"
          y2="610"
          stroke={palette.inner}
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Lower label */}
        <text
          x="500"
          y="655"
          fill={palette.inner}
          fontSize="24"
          fontWeight="600"
          textAnchor="middle"
          letterSpacing="6"
          style={{ textTransform: "uppercase" }}
        >
          CERTIFIED
        </text>
      </g>
    </svg>
  );
}

/** Tier-based sizing: Platinum slightly larger (authority stamp), Gold/Silver restrained. */
const SEAL_SIZE_CLASS: Record<SealTier, string> = {
  platinum:
    "w-[88px] h-[88px] sm:w-[96px] sm:h-[96px] md:w-[104px] md:h-[104px] print:w-[96px] print:h-[96px]",
  gold:
    "w-[80px] h-[80px] sm:w-[88px] sm:h-[88px] md:w-[92px] md:h-[92px] print:w-[88px] print:h-[88px]",
  silver:
    "w-[80px] h-[80px] sm:w-[88px] sm:h-[88px] md:w-[92px] md:h-[92px] print:w-[88px] print:h-[88px]",
};

/**
 * Default export: seal with certificate placement (bottom-right, contained).
 * Uses variant="print" by default for PDF/print-safe certificates; pass variant="web" for previews.
 */
export default function CertificationSealWithPlacement({
  tier,
  variant = "print",
  className = "",
}: CertificationSealProps) {
  const sizeClass = SEAL_SIZE_CLASS[tier];
  return (
    <div
      className={`absolute bottom-20 right-0 w-[112px] h-[112px] sm:w-[120px] sm:h-[120px] flex items-end justify-end overflow-hidden pointer-events-none select-none z-[1] pr-3 pb-2 sm:pr-4 sm:pb-2 print:pr-3 print:pb-2 ${className}`}
      aria-hidden
    >
      <div
        className={`flex items-center justify-center flex-shrink-0 ${sizeClass}`}
      >
        <CertificationSeal tier={tier} variant={variant} className="w-full h-full" />
      </div>
    </div>
  );
}
