"use client";

import {
  DEFAULT_NODE_LINKS,
  NODE_LABELS,
  type NodeLinks,
  type NetworkVariant,
} from "./constants";
import GlobalHairIntelligenceNetwork from "./GlobalHairIntelligenceNetwork";

export type GlobalHairIntelligenceSectionProps = {
  /** Current site variant — determines highlighted node. */
  variant: NetworkVariant;
  /** Section heading (site-specific). */
  heading: string;
  /** Section description (site-specific). */
  description: string;
  /** Optional override for node URLs. */
  nodeLinks?: Partial<NodeLinks>;
  /** Section size: "hero" for more elevated, breathable placement. */
  size?: "default" | "hero";
  /** Theme for the network (light/dark). */
  theme?: "light" | "dark";
  /** Node to highlight; defaults to variant. */
  highlightNode?: NetworkVariant;
  /** Whether to show a background behind the diagram (e.g. boxed SVG). */
  showBackground?: boolean;
  /** Optional class for the section. */
  className?: string;
  /** Optional section id for anchor linking. */
  id?: string;
};

const CONNECTED_PLATFORMS: Record<NetworkVariant, NetworkVariant[]> = {
  hairaudit: ["hli", "fi", "iiohr"],
  hli: ["hairaudit", "fi", "iiohr"],
  fi: ["hairaudit", "hli", "iiohr"],
  iiohr: ["hairaudit", "hli", "fi"],
};

const PLATFORM_SUMMARY: Record<NetworkVariant, string> = {
  hairaudit: "Surgical transparency, donor analysis, scoring, and corrective insight.",
  hli: "Biology-first assessment, treatment planning, and longitudinal care pathways.",
  fi: "AI pattern recognition, signal intelligence, and interpretation across cases.",
  iiohr: "Education, standards, training pathways, and professional accreditation.",
};

const SITE_CONTEXT_COPY: Record<
  NetworkVariant,
  { title: string; body: string; bullets: string[] }
> = {
  hairaudit: {
    title: "Built for surgical clarity and accountability",
    body:
      "HairAudit translates complex surgical quality signals into clear, evidence-led insight patients and clinics can act on with confidence.",
    bullets: [
      "Recipient and donor quality scoring",
      "Technique-level transparency and consistency checks",
      "Independent validation and corrective decision support",
    ],
  },
  hli: {
    title: "Biology-first intelligence for long-term outcomes",
    body:
      "Hair Longevity Institute connects diagnosis, treatment planning, and longitudinal monitoring so hair restoration decisions are informed by root-cause biology.",
    bullets: [
      "Root-cause biology and treatment pathway guidance",
      "Structured monitoring over time",
      "Integrated decision support across care stages",
    ],
  },
  fi: {
    title: "The intelligence core for the full ecosystem",
    body:
      "Follicle Intelligence powers cross-platform analysis, pattern recognition, and predictive interpretation so each platform learns from system-wide data.",
    bullets: [
      "Cross-platform signal and pattern detection",
      "AI-assisted interpretation layer",
      "Continuous model improvement from ecosystem feedback",
    ],
  },
  iiohr: {
    title: "Standards, training, and accreditation at scale",
    body:
      "IIOHR converts system intelligence into teachable standards, structured training, and accreditation pathways for consistent professional performance.",
    bullets: [
      "Evidence-based education frameworks",
      "Standardized competency pathways",
      "Accreditation aligned with measurable quality outcomes",
    ],
  },
};

export default function GlobalHairIntelligenceSection({
  variant,
  heading,
  description,
  nodeLinks,
  size = "default",
  theme: themeProp,
  highlightNode,
  showBackground = false,
  className = "",
  id,
}: GlobalHairIntelligenceSectionProps) {
  const isHero = size === "hero";
  const sectionPadding = isHero ? "py-24 sm:py-28 lg:py-32" : "py-20 sm:py-24 lg:py-28";
  const theme = themeProp ?? "light";
  const nodeToHighlight = highlightNode ?? variant;
  const links = { ...DEFAULT_NODE_LINKS, ...nodeLinks };
  const connectedCards = CONNECTED_PLATFORMS[nodeToHighlight];
  const context = SITE_CONTEXT_COPY[nodeToHighlight];

  const sectionBg =
    theme === "light"
      ? "border-slate-200 bg-neutral-50"
      : "border-slate-700/60 bg-slate-900";
  const headingClass = theme === "light" ? "text-slate-900" : "text-white";
  const bodyClass = theme === "light" ? "text-slate-600" : "text-slate-300";
  const labelClass = theme === "light" ? "text-slate-500" : "text-slate-400";
  const panelClass =
    theme === "light"
      ? "rounded-2xl border border-slate-200 bg-white p-6 sm:p-7"
      : "rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-7";
  const cardClass =
    theme === "light"
      ? "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      : "rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6";
  const cardTitleClass = theme === "light" ? "text-slate-900" : "text-white";
  const cardBodyClass = theme === "light" ? "text-slate-600" : "text-slate-300";
  const cardAccentClass = theme === "light" ? "text-amber-700" : "text-amber-300";

  return (
    <section
      id={id}
      aria-labelledby="global-hair-intelligence-heading"
      className={`relative border-t ${sectionBg} ${sectionPadding} ${className}`.trim()}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <p className={`text-xs uppercase tracking-widest font-semibold text-center ${labelClass}`}>
          Connected ecosystem
        </p>
        <h2
          id="global-hair-intelligence-heading"
          className={`mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-center ${headingClass}`}
        >
          {heading}
        </h2>
        <p className={`mt-4 text-base sm:text-lg leading-relaxed max-w-3xl mx-auto text-center ${bodyClass}`}>
          {description}
        </p>

        <div className={isHero ? "mt-12 sm:mt-16 grid lg:grid-cols-[1fr_minmax(0,1.15fr)] gap-10 lg:gap-14 items-start" : "mt-10 grid lg:grid-cols-[1fr_minmax(0,1.15fr)] gap-8 lg:gap-12 items-start"}>
          <div className={panelClass}>
            <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>
              {NODE_LABELS[nodeToHighlight]}
            </p>
            <h3 className={`mt-3 text-xl sm:text-2xl font-semibold tracking-tight ${headingClass}`}>
              {context.title}
            </h3>
            <p className={`mt-4 text-sm sm:text-base leading-relaxed ${bodyClass}`}>
              {context.body}
            </p>
            <ul className="mt-5 space-y-2.5">
              {context.bullets.map((item) => (
                <li key={item} className={`flex items-start gap-2.5 text-sm ${cardBodyClass}`}>
                  <span className={cardAccentClass} aria-hidden>
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={isHero ? "min-h-[360px]" : "min-h-[320px]"}>
            <GlobalHairIntelligenceNetwork
              variant={nodeToHighlight}
              nodeLinks={nodeLinks}
              theme={theme}
              showBackground={showBackground}
            />
          </div>
        </div>

        <div className={isHero ? "mt-12 sm:mt-14 grid md:grid-cols-3 gap-4 sm:gap-5" : "mt-10 sm:mt-12 grid md:grid-cols-3 gap-4 sm:gap-5"}>
          {connectedCards.map((id) => (
            <a
              key={id}
              href={links[id]}
              target="_blank"
              rel="noopener noreferrer"
              className={`${cardClass} block transition-colors hover:border-amber-500/40`}
            >
              <p className={`text-sm font-semibold ${cardTitleClass}`}>
                {NODE_LABELS[id]}
              </p>
              <p className={`mt-2 text-sm leading-relaxed ${cardBodyClass}`}>
                {PLATFORM_SUMMARY[id]}
              </p>
              <p className={`mt-3 text-xs font-medium ${cardAccentClass}`}>
                Open platform {"->"}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
