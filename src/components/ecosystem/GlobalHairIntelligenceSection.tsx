"use client";

import type { NodeLinks, NetworkVariant } from "./constants";
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
  /** Optional class for the section. */
  className?: string;
};

export default function GlobalHairIntelligenceSection({
  variant,
  heading,
  description,
  nodeLinks,
  size = "default",
  className = "",
}: GlobalHairIntelligenceSectionProps) {
  const isHero = size === "hero";
  const sectionPadding = isHero ? "py-24 sm:py-28 lg:py-32" : "py-20 sm:py-24 lg:py-28";
  return (
    <section
      aria-labelledby="global-hair-intelligence-heading"
      className={`relative border-t border-slate-200 bg-neutral-50 ${sectionPadding} ${className}`.trim()}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2
          id="global-hair-intelligence-heading"
          className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900"
        >
          {heading}
        </h2>
        <p className="mt-4 text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl">
          {description}
        </p>
        <div className={isHero ? "mt-14 sm:mt-16" : "mt-12 sm:mt-14"}>
          <GlobalHairIntelligenceNetwork
            variant={variant}
            nodeLinks={nodeLinks}
            theme="light"
          />
        </div>
      </div>
    </section>
  );
}
