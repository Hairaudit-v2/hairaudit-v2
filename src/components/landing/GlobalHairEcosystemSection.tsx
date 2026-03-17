"use client";

import ScrollReveal from "@/components/ui/ScrollReveal";
import EcosystemDiagramAnimated from "@/components/EcosystemDiagramAnimated";
import { PLATFORM } from "@/lib/constants/platform";

/**
 * Homepage "The Global Hair Intelligence Ecosystem" section.
 * Desktop: text left, 3D diagram right. Mobile: diagram first, then text.
 * Positions HairAudit as the surgical verification layer of a larger ecosystem.
 */
export default function GlobalHairEcosystemSection() {
  return (
    <section
      role="region"
      aria-labelledby="global-ecosystem-heading"
      className="relative border-t border-slate-700/60 bg-slate-900"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(251,191,36,0.04),transparent_50%)]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
        <h2
          id="global-ecosystem-heading"
          className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
        >
          The Global Hair Intelligence Ecosystem
        </h2>

        <div className="mt-10 lg:mt-14 grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Mobile: diagram first */}
          <div className="relative order-1 lg:order-2">
            <ScrollReveal delay={0.05}>
              <div className="min-h-[320px] flex flex-col justify-center">
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

          {/* Text: intro + platform summaries + closing */}
          <div className="order-2 lg:order-1 space-y-6 text-slate-300">
            <ScrollReveal delay={0.02}>
              <p className="text-base sm:text-lg leading-relaxed">
                HairAudit is not a standalone tool.
              </p>
              <p className="text-base sm:text-lg leading-relaxed">
                It is part of a connected global system designed to improve outcomes across every stage of the hair restoration journey — from diagnosis to treatment to surgical verification.
              </p>
              <p className="text-base sm:text-lg leading-relaxed">
                Together, these platforms create a new standard for transparency, accuracy, and long-term results.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.06}>
              <ul className="space-y-4 mt-8" aria-label="Ecosystem platforms">
                <li>
                  <span className="font-semibold text-white">{PLATFORM.HA_NAME}</span>
                  <span className="text-slate-400"> — Surgical verification and transplant quality scoring</span>
                </li>
                <li>
                  <span className="font-semibold text-white">{PLATFORM.HLI_NAME}</span>
                  <span className="text-slate-400"> — Understanding the biological causes of hair loss and long-term treatment pathways</span>
                </li>
                <li>
                  <span className="font-semibold text-white">{PLATFORM.FI_NAME}</span>
                  <span className="text-slate-400"> — The intelligence engine powering advanced hair diagnostics and analysis</span>
                </li>
              </ul>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <p className="text-amber-400/95 font-medium mt-8">
                One ecosystem. One standard. Total clarity across your hair journey.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
