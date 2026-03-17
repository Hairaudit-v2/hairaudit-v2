"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PLATFORM } from "@/lib/constants/platform";

/** Current site identifier for "You are here" and link treatment. Shared across ecosystem sites. */
export type EcosystemDiagramSite =
  | "follicleintelligence"
  | "hairaudit"
  | "hli"
  | "iiohr";

export type EcosystemDiagramAnimatedProps = {
  /** Which site is displaying the diagram (for "You are here" and non-linking current node). */
  currentSite: EcosystemDiagramSite;
  /** Visual theme; matches site design language. "dark" = stronger contrast for HairAudit. */
  theme?: "dark" | "light";
  /** Optional static fallback: skip animations. */
  static?: boolean;
  /** Optional class for the section wrapper. */
  className?: string;
  /** Optional eyebrow text above the diagram. */
  eyebrow?: string;
  /** Optional visible section title (e.g. "Part of the Hair Intelligence Ecosystem"). When set, used as visible h2 instead of sr-only. */
  title?: string;
  /** When true, hide the one-line supporting copy below the diagram (e.g. when wrapper provides its own). */
  hideSupportingCopy?: boolean;
};

const NODES = [
  {
    id: "follicleintelligence" as const,
    name: `${PLATFORM.FI_NAME}™`,
    tagline: "Central engine",
    url: PLATFORM.FI_URL,
    role: "center" as const,
  },
  {
    id: "hairaudit" as const,
    name: `${PLATFORM.HA_NAME}™`,
    tagline: "Surgical audit and scoring",
    url: PLATFORM.HA_URL,
    role: "satellite" as const,
  },
  {
    id: "hli" as const,
    name: `${PLATFORM.HLI_NAME}™`,
    tagline: "Diagnosis and treatment pathway",
    url: PLATFORM.HLI_URL,
    role: "satellite" as const,
  },
  {
    id: "iiohr" as const,
    name: `${PLATFORM.IIOHR_NAME}™`,
    tagline: "Training and certification",
    url: PLATFORM.IIOHR_URL,
    role: "satellite" as const,
  },
] as const;

const CENTER_NODE = NODES.find((n) => n.role === "center")!;
const SATELLITE_NODES = NODES.filter((n) => n.role === "satellite");

const motionConfig = {
  initial: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" },
};

export default function EcosystemDiagramAnimated({
  currentSite,
  theme = "dark",
  static: staticMode = false,
  className = "",
  eyebrow = "Hair Intelligence ecosystem",
  title,
  hideSupportingCopy = false,
}: EcosystemDiagramAnimatedProps) {
  const reduceMotion = useReducedMotion();
  const animate = !staticMode && !reduceMotion;
  const isLight = theme === "light";

  // Dark theme: stronger contrast (HairAudit premium)
  const borderCurrent = isLight
    ? "border-amber-500/50 bg-amber-500/10"
    : "border-amber-500/50 bg-amber-500/15";
  const borderDefault = isLight
    ? "border-slate-200 bg-white"
    : "border-white/20 bg-white/[0.06]";
  const textPrimary = isLight ? "text-slate-900" : "text-white";
  const textSecondary = isLight ? "text-slate-600" : "text-slate-300";
  const strokeColor = isLight ? "rgb(148 163 184)" : "rgba(251,191,36,0.35)";

  const containerVariants = animate
    ? {
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.06,
            delayChildren: 0.05,
          },
        },
      }
    : undefined;

  const itemVariants = animate
    ? {
        hidden: motionConfig.initial,
        visible: motionConfig.visible,
      }
    : undefined;

  return (
    <section
      aria-labelledby="ecosystem-diagram-heading"
      className={`relative px-4 sm:px-6 py-16 sm:py-20 ${isLight ? "border-t border-slate-200 bg-neutral-50/80" : ""} ${className}`.trim()}
    >
      <div className="max-w-4xl mx-auto">
        {title ? (
          <h2
            id="ecosystem-diagram-heading"
            className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}
          >
            {title}
          </h2>
        ) : (
          <>
            <p
              className={`text-xs uppercase tracking-widest font-medium ${isLight ? "text-slate-500" : "text-slate-500"}`}
            >
              {eyebrow}
            </p>
            <h2
              id="ecosystem-diagram-heading"
              className="mt-2 text-xl sm:text-2xl font-bold sr-only"
            >
              Hair Intelligence Ecosystem
            </h2>
          </>
        )}

        <motion.div
          className={title ? "mt-8 relative" : "mt-10 relative"}
          variants={containerVariants}
          initial={animate ? "hidden" : undefined}
          whileInView={animate ? "visible" : undefined}
          viewport={{ once: true, margin: "-24px 0px" }}
        >
          {/* Desktop: center node with three satellites and connector lines */}
          <div className="relative min-h-[320px] sm:min-h-[280px] flex flex-col items-center justify-center">
            {/* Connector lines: center to satellites (SVG overlay) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              aria-hidden
            >
              <defs>
                <linearGradient
                  id="ecosystem-line-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity="0.15" />
                </linearGradient>
              </defs>
              {/* Lines rendered per layout: center (approx 50%, 50% in content area) to each satellite. We use a simple layout: center middle, three below in a row. So lines go from center down to each of three nodes. */}
              <motion.line
                x1="50%"
                y1="42%"
                x2="20%"
                y2="78%"
                stroke="url(#ecosystem-line-grad)"
                strokeWidth="1"
                strokeDasharray="4 3"
                initial={animate ? { opacity: 0 } : undefined}
                whileInView={animate ? { opacity: 0.5 } : undefined}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="hidden sm:block"
              />
              <motion.line
                x1="50%"
                y1="42%"
                x2="50%"
                y2="78%"
                stroke="url(#ecosystem-line-grad)"
                strokeWidth="1"
                strokeDasharray="4 3"
                initial={animate ? { opacity: 0 } : undefined}
                whileInView={animate ? { opacity: 0.5 } : undefined}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="hidden sm:block"
              />
              <motion.line
                x1="50%"
                y1="42%"
                x2="80%"
                y2="78%"
                stroke="url(#ecosystem-line-grad)"
                strokeWidth="1"
                strokeDasharray="4 3"
                initial={animate ? { opacity: 0 } : undefined}
                whileInView={animate ? { opacity: 0.5 } : undefined}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="hidden sm:block"
              />
            </svg>

            {/* Row 1: Center node only */}
            <motion.div
              className="relative z-10 flex justify-center mb-6 sm:mb-4"
              variants={itemVariants}
            >
              <NodeCard
                node={CENTER_NODE}
                isCurrent={currentSite === CENTER_NODE.id}
                isLight={isLight}
                borderCurrent={borderCurrent}
                borderDefault={borderDefault}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                size="center"
              />
            </motion.div>

            {/* Row 2: Three satellite nodes */}
            <div className="relative z-10 w-full grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 sm:max-w-3xl sm:mx-auto">
              {SATELLITE_NODES.map((node, index) => (
                <motion.div
                  key={node.id}
                  className="flex justify-center"
                  variants={itemVariants}
                  style={animate ? {} : { opacity: 1 }}
                >
                  <NodeCard
                    node={node}
                    isCurrent={currentSite === node.id}
                    isLight={isLight}
                    borderCurrent={borderCurrent}
                    borderDefault={borderDefault}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    size="satellite"
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* One line of supporting copy (optional) */}
          {!hideSupportingCopy && (
            <p
              className={`mt-8 text-center text-sm max-w-2xl mx-auto ${textSecondary}`}
            >
              {PLATFORM.FI_NAME} powers analysis for {PLATFORM.HA_NAME},{" "}
              {PLATFORM.HLI_NAME}, and {PLATFORM.IIOHR_NAME} training.
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function NodeCard({
  node,
  isCurrent,
  isLight,
  borderCurrent,
  borderDefault,
  textPrimary,
  textSecondary,
  size,
}: {
  node: (typeof NODES)[number];
  isCurrent: boolean;
  isLight: boolean;
  borderCurrent: string;
  borderDefault: string;
  textPrimary: string;
  textSecondary: string;
  size: "center" | "satellite";
}) {
  const cardClass =
    "rounded-xl border w-full max-w-[260px] sm:max-w-none flex-shrink-0 p-4 sm:p-5 text-center transition-colors " +
    (isCurrent ? borderCurrent : borderDefault);

  const content = (
    <>
      <p className={`text-sm font-semibold ${textPrimary}`}>{node.name}</p>
      <p className={`mt-1 text-xs ${textSecondary}`}>{node.tagline}</p>
      {isCurrent && (
        <span
          className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${isLight ? "text-amber-800 bg-amber-500/20" : "text-amber-200 bg-amber-500/20"}`}
          aria-hidden
        >
          You are here
        </span>
      )}
      {!isCurrent && (
        <span
          className={`mt-2 inline-block text-[10px] font-medium ${isLight ? "text-amber-700" : "text-amber-400/90"}`}
        >
          Visit →
        </span>
      )}
    </>
  );

  const card = (
    <div className={`flex h-full flex-col items-center justify-center ${cardClass}`}>
      {content}
    </div>
  );

  const wrapperClass =
    size === "center"
      ? "w-full flex justify-center"
      : "w-full flex justify-center";

  if (isCurrent) {
    return (
      <div className={wrapperClass} aria-current="page">
        {card}
      </div>
    );
  }

  return (
    <a
      href={node.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex h-full flex-col items-center justify-center rounded-xl border p-4 sm:p-5 text-center transition-colors hover:border-amber-500/30 ${borderDefault} ${wrapperClass}`}
    >
      {content}
    </a>
  );
}
