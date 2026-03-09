import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { StepIcons } from "@/components/ui/StepIcons";

const steps = [
  {
    step: 1,
    title: "Upload case evidence",
    desc: "Photos, timeline, and available procedural details are submitted into a structured intake workflow.",
    icon: "submit" as const,
  },
  {
    step: 2,
    title: "Structured forensic review",
    desc: "Visual evidence is reviewed across donor pattern, recipient execution, healing signals, and documentation integrity.",
    icon: "review" as const,
  },
  {
    step: 3,
    title: "Scoring and confidence",
    desc: "Defined scoring domains are applied and weighted by evidence sufficiency and documentation quality.",
    icon: "scoring" as const,
  },
  {
    step: 4,
    title: "Human-reviewed output",
    desc: "Where applicable, findings are reviewed and finalised within a controlled workflow before release.",
    icon: "report" as const,
  },
  {
    step: 5,
    title: "Benchmark pathway",
    desc: "For eligible cases and participants, outputs can contribute to transparency and benchmark direction.",
    icon: "guidance" as const,
  },
];

const proofItems = [
  {
    title: "Methodology layer",
    desc: "Chain of evidence, scoring domains, and confidence logic are published transparently.",
    href: "/methodology",
    cta: "Read Methodology",
  },
  {
    title: "Output proof layer",
    desc: "Redacted sample report structure shows what outputs look like before purchase decisions.",
    href: "/sample-report",
    cta: "View Sample Report",
  },
  {
    title: "Service architecture",
    desc: "Clear service-by-service scope, deliverables, and decision support for each audience.",
    href: "/services",
    cta: "View Services",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(56,189,248,0.04),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Process architecture
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1]">
                How HairAudit works
              </h1>
              <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Independent review follows a defined forensic workflow: evidence intake, structured
                analysis, scoring, confidence interpretation, and controlled output finalisation.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                >
                  Request an Audit
                </Link>
                <Link
                  href="/methodology"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Read Methodology
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Workflow
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                End-to-end review sequence
              </h2>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {steps.map(({ step, title, desc, icon }, i) => (
                <ScrollReveal key={step} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 h-full">
                    <div className="w-11 h-11 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      {StepIcons[icon]}
                    </div>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Step {step}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Proof layers
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Methodology and output are both publicly inspectable
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                HairAudit is not a black-box opinion flow. The ecosystem includes explicit methodology,
                report-structure proof, and service architecture so users can evaluate quality before
                submission.
              </p>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-3 gap-6">
              {proofItems.map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 text-sm text-slate-400 leading-relaxed flex-1">{item.desc}</p>
                    <Link href={item.href} className="mt-5 inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
                      {item.cta} →
                    </Link>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Ecosystem links
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Connected platform, not isolated pages
              </h2>
            </ScrollReveal>
            <div className="mt-10 grid sm:grid-cols-2 gap-6">
              <Link href="/clinics" className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 hover:border-white/15 transition-colors">
                <h3 className="text-lg font-semibold text-white">Participating clinics</h3>
                <p className="mt-3 text-sm text-slate-400">
                  Public profiles, participation status, and recognition context across the transparency ecosystem.
                </p>
                <span className="mt-4 inline-flex text-sm font-medium text-amber-400 group-hover:underline">
                  Explore Participating Clinics →
                </span>
              </Link>
              <Link href="/verified-surgeon-program" className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 hover:border-white/15 transition-colors">
                <h3 className="text-lg font-semibold text-white">Verified Program</h3>
                <p className="mt-3 text-sm text-slate-400">
                  Structured transparency participation and recognition tiers tied to validated contribution and consistency.
                </p>
                <span className="mt-4 inline-flex text-sm font-medium text-amber-400 group-hover:underline">
                  Learn About the Verified Program →
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Move from uncertainty to structured evidence
              </h2>
              <p className="mt-4 text-slate-400">
                Choose the next entry point based on what you need now.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
                <Link href="/signup" className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20">
                  Request an Audit
                </Link>
                <Link href="/how-it-works" className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors">
                  Learn How HairAudit Works
                </Link>
                <Link href="/clinics" className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors">
                  Explore Participating Clinics
                </Link>
                <Link href="/verified-surgeon-program" className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors">
                  Learn About the Verified Program
                </Link>
                <Link href="/services" className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors">
                  View Services
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
