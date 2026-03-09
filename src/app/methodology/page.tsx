// HairAudit methodology — structured independent review framework
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";

export const metadata = {
  title: "Methodology | HairAudit",
  description:
    "How HairAudit evaluates a transplant: a structured independent methodology built around evidence, scoring, confidence, and review discipline. Forensic process, not opinion.",
};

const chainSteps = [
  {
    letter: "A",
    title: "Evidence Intake",
    desc: "Photos, timelines, procedural information, and available documentation are collected and structured for review.",
  },
  {
    letter: "B",
    title: "Visual Analysis",
    desc: "Assessment of donor pattern, hairline design, implantation pattern, density distribution, and healing signals against defined criteria.",
  },
  {
    letter: "C",
    title: "Structured Scoring",
    desc: "Cases are assessed across defined domains: planning, donor preservation, graft handling, implantation consistency, and documentation integrity.",
  },
  {
    letter: "D",
    title: "Confidence Layer",
    desc: "Scores are weighted by evidence sufficiency and documentation quality. Gaps in evidence are made explicit, not hidden.",
  },
  {
    letter: "E",
    title: "Human Review",
    desc: "Where applicable, outputs are reviewed and finalised within a controlled review workflow before delivery.",
  },
];

const coreDomains = [
  {
    title: "Surgical Planning & Design",
    definition: "Assessment of preoperative planning, hairline design intent, and recipient-zone strategy.",
    whyItMatters: "Planning directly influences aesthetic outcome, graft efficiency, and long-term naturalness.",
    evidence: "Pre-op photos, hairline design documentation, graft-count and zone allocation where available.",
  },
  {
    title: "Donor Preservation & Extraction",
    definition: "Evaluation of extraction pattern, punch impact, spacing, and donor-zone sustainability.",
    whyItMatters: "Donor management determines future capacity and risk of over-harvesting or visible depletion.",
    evidence: "Donor-area photos (pre, intra, post), extraction pattern visibility, healing in donor zone.",
  },
  {
    title: "Graft Handling & Viability",
    definition: "Assessment of graft handling, out-of-body time signals, and viability-related indicators where visible.",
    whyItMatters: "Handling and storage conditions affect survival; poor practice can undermine an otherwise well-designed procedure.",
    evidence: "Intraoperative documentation, storage and handling description, post-op healing and growth signals.",
  },
  {
    title: "Implantation Consistency & Technique",
    definition: "Evaluation of incision angles, density distribution, placement consistency, and recipient-zone execution.",
    whyItMatters: "Implantation quality drives natural appearance, coverage, and long-term aesthetic result.",
    evidence: "Recipient-zone photos, angle and distribution visibility, hairline and mid-scalp documentation.",
  },
  {
    title: "Documentation Integrity & Audit Defensibility",
    definition: "Assessment of how well the submitted evidence supports a defensible, consistent audit conclusion.",
    whyItMatters: "Transparent methodology requires that conclusions are traceable to evidence; gaps are stated, not assumed.",
    evidence: "Completeness and quality of photos, timelines, procedural detail, and clinic contribution where applicable.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(56,189,248,0.04),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        {/* ——— 1. INTRO ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Methodology
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
                How HairAudit evaluates a transplant
              </h1>
              <p className="mt-6 text-lg text-slate-400 leading-relaxed">
                A structured independent methodology built around evidence, scoring, confidence, and
                review discipline. This page outlines the chain of evidence, core scoring domains,
                and how we distinguish between quality concerns and evidence limitations.
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Analysis is assisted by{" "}
                <Link href="/follicle-intelligence" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                  Follicle Intelligence
                </Link>
                ; human review is part of the workflow where applicable.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ——— 2. CHAIN OF EVIDENCE ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Process
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Chain of evidence model
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                Every case moves through a defined sequence. This is a forensic process: evidence
                leads to analysis, analysis to scoring, scoring to confidence-weighted output, and
                human review where applicable — not a generic workflow.
              </p>
            </ScrollReveal>
            <div className="mt-12 space-y-6">
              {chainSteps.map((step, i) => (
                <ScrollReveal key={step.letter} delay={i * 0.05}>
                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-lg">
                        {step.letter}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pb-8 sm:pb-10">
                      <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                      <p className="mt-2 text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 3. CORE DOMAINS ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Scoring
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Core domains
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                Cases are assessed across the following domains. Each has a short definition, clinical
                rationale, and the types of evidence that inform it.
              </p>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {coreDomains.map((domain, i) => (
                <ScrollReveal key={domain.title} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-white/15 transition-colors h-full flex flex-col">
                    <h3 className="text-base font-semibold text-white">{domain.title}</h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">{domain.definition}</p>
                    <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                      Why it matters clinically
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{domain.whyItMatters}</p>
                    <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                      Evidence that informs it
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{domain.evidence}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 4. CONFIDENCE AND MISSING DOCUMENTATION ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Trust
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Confidence and missing documentation
              </h2>
              <p className="mt-6 text-slate-400 leading-relaxed">
                Not all cases have equal documentation. Missing or limited evidence affects our
                confidence in the assessment — it does not simply lower a score. HairAudit
                distinguishes between:
              </p>
              <ul className="mt-6 space-y-4">
                <li className="flex gap-3">
                  <span className="size-1.5 rounded-full bg-amber-500/80 mt-2 flex-shrink-0" aria-hidden />
                  <span className="text-slate-300">
                    <strong className="text-white">Quality concerns</strong> — where the evidence that
                    is present indicates a genuine concern about planning, technique, or outcome
                    potential.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="size-1.5 rounded-full bg-amber-500/80 mt-2 flex-shrink-0" aria-hidden />
                  <span className="text-slate-300">
                    <strong className="text-white">Evidence limitations</strong> — where we cannot
                    reach a confident conclusion because key documentation or views are missing or
                    insufficient.
                  </span>
                </li>
              </ul>
              <p className="mt-8 text-slate-400 leading-relaxed">
                Scores are weighted by evidence sufficiency. Where documentation is incomplete, we
                state that explicitly so that patients and clinics understand both the finding and
                the strength of the basis for it. This is a major differentiator: we do not present
                low-confidence conclusions as if they were definitive.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ——— 5. BENCHMARK DIRECTION ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Direction
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Benchmark direction
              </h2>
              <p className="mt-6 text-slate-400 leading-relaxed">
                HairAudit is being built to support independent benchmark modelling across transplant
                outcomes, documentation quality, and transparency participation. As the volume and
                quality of audited cases grow, the platform can contribute to the world’s first
                independent transplant benchmark database — location- and clinic-agnostic, and
                grounded in the same evidence and scoring discipline described on this page.
              </p>
              <p className="mt-6 text-slate-500 text-sm leading-relaxed">
                Benchmark features and participation criteria will evolve as the methodology and
                ecosystem mature. Today, the focus remains on defensible case-level review and
                transparent confidence handling.
              </p>
              <div className="mt-8 flex flex-wrap gap-6">
                <Link href="/sample-report" className="inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
                  See sample output proof →
                </Link>
                <Link href="/services" className="inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
                  View service architecture →
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ——— 6. CTA ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Next steps
              </h2>
              <p className="mt-4 text-slate-400 text-sm sm:text-base">
                Request an audit, explore participating clinics, or learn about the Verified Program.
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
