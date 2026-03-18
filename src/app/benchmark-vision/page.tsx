import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Benchmark Vision | HairAudit",
  description:
    "HairAudit benchmark vision: building independent infrastructure that may support structured transplant outcome benchmarking over time.",
  pathname: "/benchmark-vision",
});

const enablementCards = [
  {
    title: "Outcome Pattern Analysis",
    desc: "Over time, structured case reviews may allow patterns in transplant outcomes to be better understood across different approaches, techniques, and documentation quality.",
  },
  {
    title: "Transparency Signals",
    desc: "Participation in structured documentation and review processes may allow clinics and surgeons to demonstrate transparency and consistency.",
  },
  {
    title: "Patient Education",
    desc: "A benchmark-informed dataset may help patients understand what well-documented transplant outcomes look like and how evidence quality affects interpretation.",
  },
  {
    title: "Field Improvement",
    desc: "Independent benchmarking may help the field move toward more transparent reporting and evidence-informed improvement.",
  },
];

export default function BenchmarkVisionPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(56,189,248,0.04),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        {/* Hero */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Benchmark Vision
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1]">
                Building the first independent hair transplant benchmark database
              </h1>
              <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
                Hair transplantation has grown rapidly over the past two decades, yet the field still
                lacks independent outcome benchmarking.
              </p>
              <p className="mt-4 text-slate-400 leading-relaxed max-w-3xl mx-auto">
                HairAudit is being designed to support the development of a structured dataset that
                may allow transplant outcomes, documentation quality, and surgical transparency to be
                evaluated across cases over time.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  How It Works
                </Link>
                <Link
                  href="/clinics"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Explore Participating Clinics
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Section 1 */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                A growing field without objective benchmarking
              </h2>
              <p className="mt-6 text-slate-400 leading-relaxed">
                Hair transplantation is now a global medical industry involving thousands of clinics
                and surgeons.
              </p>
              <p className="mt-4 text-slate-400 leading-relaxed">
                However, patients, clinics, and practitioners currently have very limited access to
                structured outcome benchmarking.
              </p>
              <p className="mt-4 text-slate-400 leading-relaxed">
                Today, most information about transplant outcomes comes from:
              </p>
              <ul className="mt-4 space-y-2 text-slate-300">
                {[
                  "marketing material",
                  "social media posts",
                  "isolated patient experiences",
                  "individual clinic case presentations",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-amber-400">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-slate-400 leading-relaxed">
                There is no widely recognised independent system for reviewing transplant outcomes
                using consistent evidence standards.
              </p>
              <p className="mt-4 text-slate-400 leading-relaxed">
                HairAudit is being developed to help address this gap.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Section 2 */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                What independent benchmarking could make possible
              </h2>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {enablementCards.map((card, i) => (
                <ScrollReveal key={card.title} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-white/15 transition-colors h-full">
                    <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                    <p className="mt-3 text-sm text-slate-400 leading-relaxed">{card.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Structured evidence across transplant cases
              </h2>
              <p className="mt-6 text-slate-400 leading-relaxed">
                HairAudit does not simply collect opinions. The platform is designed to capture
                structured case evidence such as:
              </p>
            </ScrollReveal>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {[
                "pre-operative photos",
                "post-operative outcomes",
                "donor pattern observations",
                "hairline design patterns",
                "implantation consistency signals",
                "graft density patterns",
                "documentation completeness",
                "procedural context when available",
              ].map((item, i) => (
                <ScrollReveal key={item} delay={i * 0.03}>
                  <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3 text-sm text-slate-300">
                    {item}
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal delay={0.15}>
              <p className="mt-8 text-slate-400 leading-relaxed">
                Over time, these observations could contribute to understanding patterns across
                cases. For current service architecture and output format, see{" "}
                <Link href="/services" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
                  Services
                </Link>{" "}
                and{" "}
                <Link href="/demo-report" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
                  Sample Report
                </Link>
                .
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Section 4 */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Why structured methodology matters
              </h2>
              <p className="mt-6 text-slate-400 leading-relaxed">
                Benchmarking requires:
              </p>
              <ul className="mt-4 space-y-2 text-slate-300">
                {[
                  "consistent evidence review",
                  "structured scoring domains",
                  "confidence-aware interpretation",
                  "transparent documentation quality signals",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-amber-400">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-slate-400 leading-relaxed">
                HairAudit&apos;s methodology is designed to support these requirements.
              </p>
              <Link
                href="/methodology"
                className="mt-6 inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                Read the Methodology →
              </Link>
            </ScrollReveal>
          </div>
        </section>

        {/* Section 5 */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Encouraging voluntary transparency
              </h2>
              <p className="mt-6 text-slate-400 leading-relaxed">
                The Verified Surgeon Transparency Program allows clinics and surgeons to voluntarily
                participate by contributing documentation to audits when patients request them.
              </p>
              <p className="mt-4 text-slate-400 leading-relaxed">
                This participation can support:
              </p>
              <ul className="mt-4 space-y-2 text-slate-300">
                {[
                  "documentation completeness",
                  "confidence levels in audits",
                  "recognition for transparent practices",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-amber-400">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/verified-surgeon-program"
                className="mt-6 inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                Learn about the Verified Program →
              </Link>
            </ScrollReveal>
          </div>
        </section>

        {/* Section 6 */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                A more transparent transplant ecosystem
              </h2>
              <p className="mt-6 text-slate-400 leading-relaxed">
                HairAudit is still in its early stages.
              </p>
              <p className="mt-4 text-slate-400 leading-relaxed">
                However, the long-term goal is to support a more transparent transplant ecosystem
                where:
              </p>
              <ul className="mt-4 space-y-2 text-slate-300">
                {[
                  "patients can better understand outcomes",
                  "clinics can demonstrate documented quality",
                  "surgeons can participate in transparent review",
                  "the field benefits from structured benchmarking insights",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-amber-400">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-slate-400 leading-relaxed">
                This vision will take time and collaboration across the industry.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Explore the HairAudit platform
              </h2>
              <div className="mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
                <Link
                  href="/request-review"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                >
                  Request Review
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  How It Works
                </Link>
                <Link
                  href="/clinics"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Explore Participating Clinics
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
