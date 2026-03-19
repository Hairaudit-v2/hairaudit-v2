/**
 * Pixel-perfect institutional certification seal for Platinum, Gold, and Silver.
 * Reusable SVG: 1000×1000 viewBox, concentric rings, textPath ring text, HA monogram.
 * No gradients, glow, or heavy effects. Print-safe. Not used for Verified tier.
 */

export type CertificationSealTier = "platinum" | "gold" | "silver";

const PALETTES: Record<
  CertificationSealTier,
  { outer: string; inner: string; text: string; accent: string }
> = {
  platinum: {
    outer: "#A8ADB4",
    inner: "#6B7280",
    text: "#2B2F36",
    accent: "#C7CCD1",
  },
  gold: {
    outer: "#B08A3C",
    inner: "#7A5A21",
    text: "#4B3A17",
    accent: "#D6BE7A",
  },
  silver: {
    outer: "#9CA3AF",
    inner: "#6B7280",
    text: "#374151",
    accent: "#D1D5DB",
  },
};

type CertificationSealProps = {
  tier?: CertificationSealTier;
  className?: string;
};

/**
 * Circular institutional seal: concentric rings, HAIRAUDIT CERTIFICATION (top arc),
 * tier label (bottom arc), divider dots, center HA monogram, CERTIFIED line.
 * Geometry built on 1000×1000 viewBox for crisp scaling from ~90px to 140px+.
 */
export function CertificationSeal({
  tier = "platinum",
  className,
}: CertificationSealProps) {
  const palette = PALETTES[tier];
  const tierLabel = tier.toUpperCase();
  const idTop = `sealTextTop-${tier}`;
  const idBottom = `sealTextBottom-${tier}`;

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
        <path
          id={idTop}
          d="M 60 500 A 440 440 0 1 1 940 500"
        />
        <path
          id={idBottom}
          d="M 940 500 A 440 440 0 1 1 60 500"
        />
      </defs>

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
      />

      {/* Divider dots */}
      <circle cx="112" cy="500" r="16" fill={palette.inner} />
      <circle cx="888" cy="500" r="16" fill={palette.inner} />

      {/* Top ring text */}
      <text
        fill={palette.text}
        fontSize="48"
        fontWeight="600"
        letterSpacing="9"
        style={{ textTransform: "uppercase" }}
      >
        <textPath href={`#${idTop}`} startOffset="50%" textAnchor="middle">
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
        <textPath href={`#${idBottom}`} startOffset="50%" textAnchor="middle">
          {tierLabel}
        </textPath>
      </text>

      {/* Inner radial accents */}
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

      {/* Center monogram */}
      <text
        x="500"
        y="510"
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

      {/* Monogram underline */}
      <line
        x1="390"
        y1="610"
        x2="610"
        y2="610"
        stroke={palette.inner}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* CERTIFIED line */}
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
    </svg>
  );
}

/**
 * Default export: seal wrapped in certificate placement (bottom-right, sized).
 * Use <CertificationSeal tier="platinum" /> in certificate layout.
 * For custom placement, use the named export and wrap in your own container.
 */
export default function CertificationSealWithPlacement({
  tier = "platinum",
  className = "",
}: CertificationSealProps) {
  return (
    <div
      className={`absolute bottom-16 right-4 sm:right-5 md:right-6 z-[1] w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] md:w-[110px] md:h-[110px] print:w-[100px] print:h-[100px] flex items-center justify-center pointer-events-none select-none ${className}`}
      aria-hidden
    >
      <CertificationSeal tier={tier} className="w-full h-full" />
    </div>
  );
}
