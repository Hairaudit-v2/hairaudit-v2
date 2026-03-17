"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  type NetworkVariant,
  type NodeLinks,
  DEFAULT_NODE_LINKS,
  NODE_LABELS,
} from "./constants";

export type GlobalHairIntelligenceNetworkProps = {
  /** Current site — this node is highlighted and not a link. */
  variant: NetworkVariant;
  /** Override node URLs; defaults to DEFAULT_NODE_LINKS. */
  nodeLinks?: Partial<NodeLinks>;
  /** Visual theme for nodes. "light" for soft light section background. */
  theme?: "light" | "dark";
  /** When true, show a background behind the diagram (e.g. boxed SVG). Default false. */
  showBackground?: boolean;
  /** Optional class for the wrapper. */
  className?: string;
};

const CENTER_ID = "fi" as const;
const SATELLITE_IDS = ["hairaudit", "hli", "iiohr"] as const;

const motionConfig = {
  initial: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" as const },
};

const DEBUG_VISIBILITY = false;

export default function GlobalHairIntelligenceNetwork({
  variant,
  nodeLinks: nodeLinksOverride,
  theme = "light",
  showBackground = false,
  className = "",
}: GlobalHairIntelligenceNetworkProps) {
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;
  const links = { ...DEFAULT_NODE_LINKS, ...nodeLinksOverride };
  const isLight = theme === "light";

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

  const borderCurrent = isLight
    ? "border-amber-500/50 bg-amber-500/10"
    : "border-amber-500/50 bg-amber-500/15";
  const borderDefault = isLight
    ? "border-slate-200 bg-white"
    : "border-white/20 bg-white/[0.06]";

  const wrapperClass =
    `relative w-full min-h-[320px] overflow-visible ${className}`.trim() +
    (DEBUG_VISIBILITY ? " border-4 border-red-500 bg-amber-100" : "");

  return (
    <div className={wrapperClass}>
      <motion.div
        className="relative min-h-[300px] sm:min-h-[280px] flex flex-col items-center justify-center w-full"
        variants={containerVariants}
        initial="visible"
        whileInView={animate ? "visible" : undefined}
        viewport={{ once: true, margin: "50px 0px", amount: 0.01 }}
      >
        {/* Center node: Follicle Intelligence */}
        <motion.div
          className="relative z-10 flex justify-center mb-6 sm:mb-4"
          variants={itemVariants}
          initial="visible"
        >
          <NodeCard
            id={CENTER_ID}
            label={NODE_LABELS[CENTER_ID]}
            tagline="Central engine"
            href={links[CENTER_ID]}
            isCurrent={variant === CENTER_ID}
            isLight={isLight}
            borderCurrent={borderCurrent}
            borderDefault={borderDefault}
          />
        </motion.div>

        {/* Satellite nodes */}
        <div className="relative z-10 w-full grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 sm:max-w-3xl sm:mx-auto">
          {SATELLITE_IDS.map((id) => (
            <motion.div
              key={id}
              className="flex justify-center"
              variants={itemVariants}
              initial="visible"
            >
              <NodeCard
                id={id}
                label={NODE_LABELS[id]}
                tagline={
                  id === "hairaudit"
                    ? "Surgical audit and scoring"
                    : id === "hli"
                      ? "Diagnosis and treatment pathway"
                      : "Training and certification"
                }
                href={links[id]}
                isCurrent={variant === id}
                isLight={isLight}
                borderCurrent={borderCurrent}
                borderDefault={borderDefault}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function NodeCard({
  id,
  label,
  tagline,
  href,
  isCurrent,
  isLight,
  borderCurrent,
  borderDefault,
}: {
  id: string;
  label: string;
  tagline: string;
  href: string;
  isCurrent: boolean;
  isLight: boolean;
  borderCurrent: string;
  borderDefault: string;
}) {
  const cardClass =
    "rounded-xl border w-full max-w-[260px] sm:max-w-none flex-shrink-0 p-4 sm:p-5 text-center transition-colors " +
    (isCurrent ? borderCurrent : borderDefault);

  const textPrimary = isLight ? "text-slate-900" : "text-white";
  const textSecondary = isLight ? "text-slate-600" : "text-slate-300";
  const badgeClass = isLight
    ? "text-amber-800 bg-amber-500/20"
    : "text-amber-200 bg-amber-500/20";
  const visitClass = isLight ? "text-amber-700" : "text-amber-400/90";

  const content = (
    <>
      <p className={`text-sm font-semibold ${textPrimary}`}>{label}</p>
      <p className={`mt-1 text-xs ${textSecondary}`}>{tagline}</p>
      {isCurrent && (
        <span
          className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${badgeClass}`}
          aria-hidden
        >
          You are here
        </span>
      )}
      {!isCurrent && (
        <span className={`mt-2 inline-block text-[10px] font-medium ${visitClass}`}>
          Visit →
        </span>
      )}
    </>
  );

  if (isCurrent) {
    return (
      <div className="w-full flex justify-center" aria-current="page">
        <div className={`flex h-full flex-col items-center justify-center ${cardClass}`}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex h-full flex-col items-center justify-center rounded-xl border p-4 sm:p-5 text-center transition-colors hover:border-amber-500/30 ${borderDefault} w-full flex justify-center`}
    >
      {content}
    </a>
  );
}
