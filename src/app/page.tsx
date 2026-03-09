// HairAudit homepage — med-tech standards platform
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";

export const revalidate = 600;

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      {/* Subtle background gradients — premium dark med-tech */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(56,189,248,0.04),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        {/* ——— 1. HERO ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-white leading-[1.1]">
              Independent Forensic Benchmarking for Hair Transplant Outcomes
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
              HairAudit provides independent, evidence-based review of transplant outcomes using
              structured visual evidence analysis, surgical scoring, and benchmark-led methodology.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                Request an Audit
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                Learn How HairAudit Works
              </Link>
            </div>
            <p className="mt-4">
              <Link
                href="/clinics"
                className="text-sm font-medium text-slate-500 hover:text-amber-400 transition-colors"
              >
                Explore Participating Clinics →
              </Link>
            </p>
            {/* Hero support strip — no inflated metrics */}
            <div className="mt-12 flex flex-wrap justify-center gap-6 sm:gap-8 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-amber-500/80" aria-hidden />
                Independent review
              </span>
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-amber-500/80" aria-hidden />
                Structured evidence analysis
              </span>
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-amber-500/80" aria-hidden />
                Human-reviewed outputs
              </span>
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-amber-500/80" aria-hidden />
                Methodology supported by{" "}
                <Link href="/follicle-intelligence" className="text-amber-400/90 hover:text-amber-400 transition-colors">
                  Follicle Intelligence
                </Link>
              </span>
            </div>
          </div>
        </section>

        {/* ——— 2. CATEGORY DEFINING STRIP ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Why HairAudit exists
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight max-w-2xl">
                The category-defining layer for transplant outcome transparency.
              </h2>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-3 gap-6">
              {[
                {
                  title: "Independent",
                  desc: "HairAudit does not perform procedures and is designed to review outcomes without provider-side bias.",
                },
                {
                  title: "Evidence-Based",
                  desc: "Each case is assessed using visual documentation, structured scoring domains, and confidence-aware methodology.",
                },
                {
                  title: "Benchmark-Oriented",
                  desc: "The platform is being built to support the world's first independent transplant benchmark database.",
                },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8 hover:border-white/15 transition-colors h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 text-sm text-slate-400 leading-relaxed flex-1">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 3. WHO IT IS FOR ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Who it is for
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Built for patients, clinics, surgeons, and the future of benchmarking.
              </h2>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  who: "Patients",
                  why: "Get an independent view of your procedure and outcome potential.",
                  decision: "Helps you understand quality, corrective options, and next steps.",
                },
                {
                  who: "Clinics",
                  why: "Benchmark your work against structured criteria and transparency standards.",
                  decision: "Supports quality improvement and evidence-based positioning.",
                },
                {
                  who: "Surgeons / Doctors",
                  why: "Demonstrate transparency and participate in independent recognition.",
                  decision: "Helps you stand on documented performance, not marketing alone.",
                },
                {
                  who: "Future benchmark participants",
                  why: "The ecosystem is evolving toward a global transplant quality standard.",
                  decision: "Early participation shapes how benchmarks are defined and used.",
                },
              ].map((item, i) => (
                <ScrollReveal key={item.who} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-white/15 transition-colors h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-white">{item.who}</h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">{item.why}</p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                      Decision it supports
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{item.decision}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 4. HOW THE PLATFORM WORKS ——— */}
        <section id="how-it-works" className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                How the platform works
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                From evidence to report to benchmark.
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                Platform-led workflow with human review at the core. Analysis is assisted by{" "}
                <Link href="/follicle-intelligence" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                  Follicle Intelligence
                </Link>
                .
              </p>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { step: 1, title: "Upload case evidence", desc: "Photos and case details submitted for review." },
                { step: 2, title: "Structured forensic review", desc: "Visual evidence and domain-based analysis." },
                { step: 3, title: "Scoring and confidence analysis", desc: "Defined criteria and confidence-aware outputs." },
                { step: 4, title: "Human-reviewed report output", desc: "Structured report with scores and transparency." },
                { step: 5, title: "Benchmark / recognition pathway", desc: "Where relevant, contribution to benchmarks and recognition." },
              ].map(({ step, title, desc }, i) => (
                <ScrollReveal key={step} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 text-center sm:text-left">
                    <div className="w-10 h-10 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm mx-auto sm:mx-0">
                      {step}
                    </div>
                    <h3 className="mt-3 font-semibold text-white text-sm sm:text-base">{title}</h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-slate-400">{desc}</p>
                    {i === 4 && (
                      <Link href="/verified-surgeon-program" className="mt-3 inline-block text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors">
                        Verified Program →
                      </Link>
                    )}
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal delay={0.2}>
              <div className="mt-8 text-center">
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                >
                  Full process and methodology →
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ——— 5. PROOF OF METHODOLOGY PREVIEW ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Proof of methodology
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Structured, transparent, and confidence-aware.
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                Our approach is built on visual evidence review, defined scoring domains, confidence
                logic, and a benchmark framework. Human review ensures every output is validated.
              </p>
            </ScrollReveal>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Visual evidence review", short: "Documentation and photo-based analysis." },
                { label: "Structured scoring", short: "Domain-based criteria and consistency." },
                { label: "Confidence logic", short: "Transparent limits and reliability signals." },
                { label: "Benchmark framework", short: "Toward a global transplant quality standard." },
              ].map((item, i) => (
                <ScrollReveal key={item.label} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:border-white/15 transition-colors">
                    <h3 className="font-semibold text-white text-sm">{item.label}</h3>
                    <p className="mt-1.5 text-xs text-slate-400">{item.short}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal delay={0.15}>
              <div className="mt-8 flex flex-wrap gap-6">
                <Link
                  href="/methodology"
                  className="inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Read the full methodology →
                </Link>
                <Link
                  href="/sample-report"
                  className="inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  See sample output →
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ——— 6. SERVICES PREVIEW ——— */}
        <section id="services" className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Audit categories
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Forensic review by domain and use case.
              </h2>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Patient Audit",
                  desc: "Independent review of your procedure: donor, graft handling, implantation, and outcome potential.",
                  deliverable: "Structured forensic report with scores and next-step guidance.",
                  href: "/signup",
                  cta: "Request an Audit",
                },
                {
                  title: "Clinic Benchmark Review",
                  desc: "Structured audits for clinics seeking independent benchmarking and quality improvement.",
                  deliverable: "Benchmark scores, improvement areas, and case consistency insight.",
                  href: "/services",
                  cta: "Learn more",
                },
                {
                  title: "Surgeon / Transparency Review",
                  desc: "Recognition through validated participation and documentation within the independent framework.",
                  deliverable: "Transparency participation, validated metrics, and recognition tiers.",
                  href: "/verified-surgeon-program",
                  cta: "Verified Program",
                },
                {
                  title: "Corrective / Outcome Review",
                  desc: "Assessment of surgical outcomes, healing, graft survival signals, and corrective planning.",
                  deliverable: "Outcome-focused report and follow-up or corrective guidance where relevant.",
                  href: "/signup",
                  cta: "Request an Audit",
                },
              ].map((card, i) => (
                <ScrollReveal key={card.title} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-white/15 transition-colors h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed flex-1">{card.desc}</p>
                    <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                      Key deliverable
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{card.deliverable}</p>
                    <Link
                      href={card.href}
                      className="mt-5 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 transition-colors"
                    >
                      {card.cta} →
                    </Link>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal delay={0.2}>
              <div className="mt-10 text-center">
                <Link
                  href="/services"
                  className="inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  View all services →
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ——— 7. CLINICS / VERIFIED PROGRAM PREVIEW ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Ecosystem
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                More than a single report — a transparency standard.
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                Explore participating clinics and the Verified Surgeon Transparency Program. The
                ecosystem connects patients, clinics, and benchmarks in one independent framework.
              </p>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-2 gap-6">
              <ScrollReveal delay={0.05}>
                <Link
                  href="/clinics"
                  className="group block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 hover:border-amber-500/30 hover:bg-white/[0.07] transition-all"
                >
                  <h3 className="text-xl font-semibold text-white group-hover:text-amber-400 transition-colors">
                    Clinics directory
                  </h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                    Browse clinics in the HairAudit transparency ecosystem. Profiles reflect
                    validated participation, documentation contribution, and recognition tiers.
                  </p>
                  <span className="mt-4 inline-flex items-center text-sm font-medium text-amber-400 group-hover:underline">
                    Explore Participating Clinics →
                  </span>
                </Link>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <Link
                  href="/verified-surgeon-program"
                  className="group block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 hover:border-amber-500/30 hover:bg-white/[0.07] transition-all"
                >
                  <h3 className="text-xl font-semibold text-white group-hover:text-amber-400 transition-colors">
                    Verified Surgeon Transparency Program
                  </h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                    Recognition for clinics and surgeons who participate with transparency:
                    documentation contribution, validated case performance, and consistent standards.
                  </p>
                  <span className="mt-4 inline-flex items-center text-sm font-medium text-amber-400 group-hover:underline">
                    Learn About the Verified Program →
                  </span>
                </Link>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ——— 8. FINAL CTA ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-snug">
                Independent review for a field that has lacked objective standards.
              </h2>
              <p className="mt-6 text-slate-400 text-sm sm:text-base leading-relaxed">
                Request an audit, explore participating clinics, or learn how the HairAudit
                transparency ecosystem works.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                >
                  Request an Audit
                </Link>
                <Link
                  href="/clinics"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Explore Participating Clinics
                </Link>
                <Link
                  href="/verified-surgeon-program"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Learn About the Verified Program
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Learn How HairAudit Works
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
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
