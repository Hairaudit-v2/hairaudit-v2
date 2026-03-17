"use client";

import ScrollReveal from "@/components/ui/ScrollReveal";
import EcosystemDiagramAnimated from "@/components/EcosystemDiagramAnimated";
import { PLATFORM } from "@/lib/constants/platform";

/**
 * Homepage "The Global Hair Intelligence Ecosystem" section.
 * Desktop: text left, ecosystem diagram right (large, premium). Mobile: diagram first, then text.
 * Reusable pattern for sister sites; positions HairAudit as part of the global hair intelligence system.
 */
export default function GlobalHairEcosystemSection() {
  return (
    <section
      role="region"
      aria-labelledby="global-ecosystem-heading"
      className="relative border-t border-slate-700/60 bg-slate-900 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(251,191,36,0.04),transparent_50%)]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24 lg:py-28">
        <h2
          id="global-ecosystem-heading"
          className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
        >
          The Global Hair Intelligence Ecosystem
        </h2>

        <div className="mt-12 lg:mt-16 grid lg:grid-cols-[1fr_minmax(0,1.15fr)] gap-14 lg:gap-20 xl:gap-24 items-center">
          {/* Desktop: left column = text. Mobile: second (below diagram). */}
          <div className="order-2 lg:order-1 space-y-6">
            <ScrollReveal delay={0.02}>
              <p className="text-base sm:text-lg leading-relaxed text-slate-200">
                HairAudit is not a standalone tool.
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-slate-200">
                It is part of a connected global system designed to improve outcomes across every stage of the hair restoration journey — from diagnosis to treatment to surgical verification.
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-slate-200">
                Together, these platforms create a new standard for transparency, accuracy, and long-term results.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.06}>
              <ul className="space-y-5 mt-8" aria-label="Ecosystem platforms">
                <li className="flex flex-col gap-1">
                  <span className="font-semibold text-white">{PLATFORM.HA_NAME}</span>
                  <span className="text-slate-300 text-sm sm:text-base">Surgical verification and transplant quality scoring</span>
                </li>
                <li className="flex flex-col gap-1">
                  <span className="font-semibold text-white">{PLATFORM.HLI_NAME}</span>
                  <span className="text-slate-300 text-sm sm:text-base">Understanding the biological causes of hair loss and long-term treatment pathways</span>
                </li>
                <li className="flex flex-col gap-1">
                  <span className="font-semibold text-white">{PLATFORM.FI_NAME}</span>
                  <span className="text-slate-300 text-sm sm:text-base">The intelligence engine powering advanced hair diagnostics and analysis</span>
                </li>
              </ul>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <p className="text-amber-400 font-semibold text-lg mt-10">
                One ecosystem. One standard. Total clarity across your hair journey.
              </p>
            </ScrollReveal>
          </div>

          {/* Desktop: right column = diagram (large, premium). Mobile: first. */}
          <div className="relative order-1 lg:order-2 overflow-visible min-h-[320px] sm:min-h-[340px] flex flex-col justify-center">
            <ScrollReveal delay={0.05}>
              <div className="w-full overflow-visible">
                <EcosystemDiagramAnimated
                  currentSite="hairaudit"
                  theme="dark"
                  eyebrow=""
                  hideSupportingCopy
                  className="!py-0 !px-0 !border-0"
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
