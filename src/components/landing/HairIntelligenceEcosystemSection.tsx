"use client";

import Link from "next/link";
import ScrollReveal from "@/components/ui/ScrollReveal";
import EcosystemDiagramAnimated from "@/components/EcosystemDiagramAnimated";

/**
 * Homepage ecosystem block: positions HairAudit as one pillar of the Hair Intelligence
 * ecosystem. Uses dark/premium theme, subtle motion, stronger contrast.
 * Placement: after main value proposition, before deeper product/detail sections.
 */
export default function HairIntelligenceEcosystemSection() {
  return (
    <div
      role="region"
      aria-labelledby="ecosystem-diagram-heading"
      className="relative border-t border-slate-700/60 bg-slate-900"
    >
      {/* Subtle gradient for premium feel, no clutter */}
      <div
        className="absolute inset-0 pointer-events-none aria-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(251,191,36,0.04),transparent_50%)]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <ScrollReveal delay={0.03}>
          <EcosystemDiagramAnimated
            currentSite="hairaudit"
            theme="dark"
            title="Part of the Hair Intelligence Ecosystem"
            hideSupportingCopy
            className="!py-0 !px-0"
          />
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <p className="mt-6 text-slate-300 text-sm sm:text-base max-w-2xl mx-auto text-center leading-relaxed">
            HairAudit delivers surgical truth through independent scoring and
            validation—one pillar of a broader intelligence ecosystem that
            connects analysis, treatment pathways, and training.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.12}>
          <p className="mt-8 text-center">
            <Link
              href="/methodology"
              className="inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-md"
            >
              See How HairAudit Fits In
              <span className="ml-1.5" aria-hidden>
                →
              </span>
            </Link>
          </p>
        </ScrollReveal>
      </div>
    </div>
  );
}
