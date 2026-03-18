import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import TrackedLink from "@/components/analytics/TrackedLink";
import GlobalHairIntelligenceSection from "@/components/ecosystem/GlobalHairIntelligenceSection";
import { StepIcons } from "@/components/ui/StepIcons";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import OrganizationWebSiteSchema from "@/components/seo/OrganizationWebSiteSchema";

export const revalidate = 600;
export const metadata = createPageMetadata({
  title: "HairAudit",
  description:
    "Was your hair transplant done properly? Get a clinical audit of your results — based on real surgical standards, not opinions.",
  pathname: "/",
});

const HOW_IT_WORKS_STEPS = [
  {
    title: "Upload Your Photos",
    description: "Securely upload images of your donor and recipient areas. Takes less than 2 minutes.",
    icon: StepIcons.submit,
  },
  {
    title: "We Analyse Your Surgery",
    description: "Our system evaluates extraction quality, density, donor management, and surgical technique.",
    icon: StepIcons.review,
  },
  {
    title: "Receive Your HairAudit Report",
    description: "Get your HairAudit Score, visual breakdown, and clear next-step recommendations.",
    icon: StepIcons.report,
  },
] as const;

const WHAT_YOU_GET_ITEMS = [
  {
    title: "HairAudit Score (0–100)",
    description: "A clear rating of your surgical outcome based on clinical standards.",
  },
  {
    title: "Donor Area Analysis",
    description: "Assessment of extraction pattern, overharvesting risk, and donor preservation.",
  },
  {
    title: "Density & Placement Review",
    description: "Evaluation of graft placement, spacing, and naturalness.",
  },
  {
    title: "Surgical Technique Insights",
    description: "Identification of technique quality and potential red flags.",
  },
  {
    title: "Personalised Recommendations",
    description: "Clear guidance on next steps, improvements, or corrective options.",
  },
] as const;

const WHO_IT_FOR_ITEMS = [
  "Patients who want to understand the true quality of their hair transplant",
  "Anyone considering surgery and wanting to avoid poor outcomes",
  "Patients who have had a transplant and are unsure about their results",
  "Clinics and doctors who want independent validation of their work",
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <OrganizationWebSiteSchema />
      <SiteHeader />

      <main id="main-content" className="relative flex-1">
        {/* 1. Hero */}
        <section className="relative px-4 sm:px-6 pt-16 sm:pt-20 pb-20 sm:pb-28 lg:pt-24 lg:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]">
                Was Your Hair Transplant Done Properly?
              </h1>
              <p className="mt-6 text-xl text-slate-300 max-w-xl mx-auto leading-relaxed">
                Get a clinical audit of your results — based on real surgical standards, not opinions.
              </p>
              <p className="mt-4 text-slate-400 max-w-lg mx-auto">
                Upload your photos and receive a detailed HairAudit Score, donor analysis, and surgical quality breakdown.
              </p>
              <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_start_audit_hero"
                  className="inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold text-lg hover:bg-amber-400 transition-colors border border-amber-400/50 shadow-lg shadow-amber-500/20"
                >
                  Start My Audit
                </TrackedLink>
                <Link
                  href="/demo-report"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-2xl border-2 border-slate-500 text-slate-200 font-medium hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                >
                  View Sample Report
                </Link>
              </div>
              <p className="mt-8 text-sm text-slate-500">
                Used by trichologists, surgeons, and global training academies
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 2. How It Works */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-700/60">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                How HairAudit Works
              </h2>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-3 gap-8 sm:gap-6">
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <ScrollReveal key={step.title} delay={0.03 + index * 0.02}>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-6 flex flex-col items-center text-center">
                    <span className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                      {step.icon}
                    </span>
                    <p className="mt-4 text-sm font-semibold text-amber-400/90 uppercase tracking-wider">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Ecosystem — canonical shared GlobalHairIntelligenceSection (single instance) */}
        <GlobalHairIntelligenceSection
          variant="hairaudit"
          heading="Part of the Global Hair Intelligence Network"
          description="HairAudit sits within a connected global system linking hair biology, treatment planning, surgical transparency, and AI-driven analysis."
          size="hero"
          theme="light"
        />

        {/* 4. What You Get */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 bg-slate-800/30">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Your HairAudit Report Includes
              </h2>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {WHAT_YOU_GET_ITEMS.map((item) => (
                <ScrollReveal key={item.title} delay={0.02}>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6">
                    <h3 className="text-base font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Sample Report teaser */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                See What Your Results Could Reveal
              </h2>
              <p className="mt-5 text-slate-300 leading-relaxed text-lg">
                Every HairAudit report provides a clear, visual breakdown of your surgery — showing what was done well and what may need attention.
              </p>
              <ul className="mt-8 space-y-3 text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="text-amber-400 mt-0.5" aria-hidden>✓</span>
                  Visual scoring with annotated images
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-400 mt-0.5" aria-hidden>✓</span>
                  Donor and recipient area analysis
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-400 mt-0.5" aria-hidden>✓</span>
                  Red flags and risk indicators
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-400 mt-0.5" aria-hidden>✓</span>
                  Clear clinical explanation — no confusing terminology
                </li>
              </ul>
              <div className="mt-10">
                <TrackedLink
                  href="/demo-report"
                  eventName="cta_view_sample_report_teaser"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors border border-amber-400/50"
                >
                  View Full Sample Report
                </TrackedLink>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* 6. Why HairAudit Matters — tightened */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 bg-slate-800/30">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Why HairAudit Matters
              </h2>
              <div className="mt-6 space-y-4 text-slate-300 leading-relaxed text-lg">
                <p>
                  Results are often judged by appearance alone — but what looks acceptable can hide poor technique. HairAudit assesses what most patients cannot see: how grafts were extracted, how the donor was managed, and whether the work meets real clinical standards.
                </p>
                <p className="text-slate-200 font-medium">
                  Not a sales tool. Independent verification of your results.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* 7. Who It's For */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Who HairAudit Is For
              </h2>
              <ul className="mt-10 space-y-4">
                {WHO_IT_FOR_ITEMS.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-slate-300"
                  >
                    <span className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden>•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </section>

        {/* 8. Trust / privacy */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 bg-slate-800/30">
          <div className="max-w-2xl mx-auto">
            <ScrollReveal>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Your Data, Protected
              </h2>
              <p className="mt-4 text-slate-400 leading-relaxed">
                All uploads are securely stored and handled with strict privacy controls. Your data is never shared without your consent.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 9. Final CTA */}
        <section className="relative px-4 sm:px-6 py-24 sm:py-28 border-t border-slate-700/60">
          <div className="max-w-2xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Get Clarity on Your Hair Transplant
              </h2>
              <p className="mt-5 text-xl text-slate-300">
                Understand your results. Identify risks. Make informed decisions.
              </p>
              <div className="mt-10">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_start_audit_final"
                  className="inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold text-lg hover:bg-amber-400 transition-colors border border-amber-400/50 shadow-lg shadow-amber-500/20"
                >
                  Start My Audit
                </TrackedLink>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
