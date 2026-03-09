// HairAudit Services — premium product architecture
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";

export const metadata = {
  title: "Services | HairAudit",
  description:
    "Structured product architecture: Patient Forensic Audit, Corrective Review, Clinic Benchmark Review, and Transparency Participation. Independent, evidence-based audit services.",
};

const comparisonRows = [
  {
    id: "patient",
    service: "Patient Forensic Audit",
    audience: "Patients seeking independent review of a transplant result, concern, or disputed outcome.",
    mainInput: "Case photos, timeline, procedural information (patient-submitted).",
    mainOutput: "Forensic audit report with structured scorecard, visual evidence review, confidence interpretation, corrective planning insight where relevant.",
    mainDecision: "Whether the outcome aligns with expected standards; what next step — if any — may be justified.",
  },
  {
    id: "corrective",
    service: "Corrective / Outcome Review",
    audience: "Patients or advisors seeking structured understanding of what may have gone wrong and what evidence matters next.",
    mainInput: "Outcome photos, healing timeline, any procedural or clinic documentation available.",
    mainOutput: "Outcome-focused forensic report: healing/survival evidence, density potential, corrective planning and follow-up guidance where relevant.",
    mainDecision: "Whether the result is on track; what may be affecting it; whether further intervention or reassurance is appropriate.",
  },
  {
    id: "clinic",
    service: "Clinic Benchmark Review",
    audience: "Clinics seeking independent review of case documentation, benchmark readiness, and transparency participation quality.",
    mainInput: "Case documentation, contribution history, submitted evidence (clinic-contributed where applicable).",
    mainOutput: "Benchmark-oriented case review, scorecard, transparency contribution impact, recognition-readiness and next-milestone insight.",
    mainDecision: "Benchmark readiness; quality improvement priorities; evidence-based positioning in the ecosystem.",
  },
  {
    id: "transparency",
    service: "Surgeon / Transparency Participation Review",
    audience: "Surgeons or participating providers contributing documentation within the HairAudit ecosystem.",
    mainInput: "Documentation contribution to cases, validated case performance, transparency participation.",
    mainOutput: "Transparency participation metrics, validated performance view, recognition tier and progression insight, audit-quality feedback.",
    mainDecision: "How participation supports recognition; documentation and consistency improvements; standing within the Verified Program.",
  },
];

const serviceBlocks = [
  {
    id: "patient",
    name: "Patient Forensic Audit",
    whoItIsFor:
      "Patients seeking independent review of a transplant result, concern, or disputed outcome.",
    whatIsAnalysed: [
      "Donor extraction pattern, spacing, and sustainability",
      "Graft handling and viability signals where visible",
      "Implantation quality, density distribution, hairline design",
      "Healing and growth evidence from submitted photos",
      "Documentation completeness and its impact on confidence",
    ],
    whatYouReceive: [
      "Forensic audit report with structured scorecard",
      "Structured visual evidence review across scoring domains",
      "Scoring summary with domain-level breakdown",
      "Confidence interpretation — what we can and cannot conclude",
      "Corrective planning insight where relevant",
      "Clear next-step guidance based on findings",
    ],
    whyItMatters:
      "Helps you understand whether the outcome aligns with expected surgical standards and what next step — if any — may be justified. Independence means no provider-side bias.",
    href: "/signup",
    cta: "Request an Audit",
  },
  {
    id: "corrective",
    name: "Corrective / Outcome Review",
    whoItIsFor:
      "Patients or advisors seeking structured understanding of what may have gone wrong and what evidence matters next.",
    whatIsAnalysed: [
      "Healing and scarring indicators",
      "Graft survival and retention signals",
      "Density and coverage progression",
      "Factors that may limit or support final result",
      "Donor and recipient evidence where available",
    ],
    whatYouReceive: [
      "Outcome-focused forensic report",
      "Structured assessment of healing and survival evidence",
      "Density and aesthetic potential assessment",
      "Confidence-aware findings — quality concerns vs evidence limitations",
      "Follow-up and corrective planning where relevant",
    ],
    whyItMatters:
      "Helps you gauge whether the result is on track, what may be affecting it, and whether further intervention or reassurance is appropriate. Distinguishes genuine concerns from evidence gaps.",
    href: "/signup",
    cta: "Request an Audit",
  },
  {
    id: "clinic",
    name: "Clinic Benchmark Review",
    whoItIsFor:
      "Clinics seeking independent review of case documentation, benchmark readiness, and transparency participation quality.",
    whatIsAnalysed: [
      "Planning and documentation quality",
      "Donor preservation and extraction discipline",
      "Graft viability chain and handling",
      "Implantation consistency and hairline design",
      "Documentation integrity for benchmark eligibility",
    ],
    whatYouReceive: [
      "Benchmark-oriented case review and scorecard",
      "Structured visual evidence review and scoring summary",
      "Transparency contribution impact on recognition",
      "Recognition-readiness and next-milestone insight",
      "Structured feedback for quality improvement",
    ],
    whyItMatters:
      "Helps clinics strengthen transparency, understand benchmark readiness, and support evidence-based positioning in the HairAudit ecosystem — without marketing spin.",
    href: "/verified-surgeon-program",
    cta: "Learn About Participation",
  },
  {
    id: "transparency",
    name: "Surgeon / Transparency Participation Review",
    whoItIsFor:
      "Surgeons or participating providers contributing documentation within the HairAudit ecosystem.",
    whatIsAnalysed: [
      "Documentation contribution quality and consistency",
      "Case-level audit performance across domains",
      "Transparency participation and contribution patterns",
      "Benchmark-eligible and validated case metrics",
    ],
    whatYouReceive: [
      "Transparency participation metrics and audit-quality feedback",
      "Validated performance view and scorecard insight",
      "Recognition tier and progression toward next milestone",
      "Benchmark and transparency relevance for your profile",
    ],
    whyItMatters:
      "Helps you understand how participation supports recognition, where documentation and consistency can improve, and how you stand within the Verified Program.",
    href: "/verified-surgeon-program",
    cta: "Learn About the Verified Program",
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(56,189,248,0.04),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        {/* ——— HERO ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Product architecture
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1]">
                Forensic audit services
              </h1>
              <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Structured review types by audience and decision: patient audits, corrective and outcome
                review, clinic benchmark review, and transparency participation. Each has a defined
                scope, deliverable set, and decision impact.
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Methodology supported by{" "}
                <Link href="/follicle-intelligence" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
                  Follicle Intelligence
                </Link>
                . HairAudit does not perform procedures or promote clinics.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ——— COMPARISON STRIP ——— */}
        <section className="relative px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                At a glance
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Service comparison
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                Audience, main input, main output, and the decision each service supports.
              </p>
            </ScrollReveal>
            <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 sm:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Service
                      </th>
                      <th className="px-4 sm:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Audience
                      </th>
                      <th className="px-4 sm:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Main input
                      </th>
                      <th className="px-4 sm:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Main output
                      </th>
                      <th className="px-4 sm:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Main decision supported
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-4 font-medium text-white text-sm">
                          {row.service}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-slate-400 max-w-[200px]">
                          {row.audience}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-slate-400 max-w-[180px]">
                          {row.mainInput}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-slate-400 max-w-[220px]">
                          {row.mainOutput}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-slate-400 max-w-[200px]">
                          {row.mainDecision}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ——— SERVICE BLOCKS ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Scope and deliverables
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Core services
              </h2>
              <p className="mt-4 text-slate-400">
                For each service: who it is for, what is analysed, what you receive, why it matters, and how to proceed.
              </p>
            </ScrollReveal>
            <div className="mt-12 space-y-16 sm:space-y-20">
              {serviceBlocks.map((block, i) => (
                <ScrollReveal key={block.id} delay={i * 0.03}>
                  <article className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden hover:border-white/15 transition-colors">
                    <div className="p-6 sm:p-8 lg:p-10">
                      <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        {block.name}
                      </h3>
                      <div className="mt-8 grid sm:grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                        <div className="space-y-6">
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Who it is for
                            </h4>
                            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                              {block.whoItIsFor}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              What is analysed
                            </h4>
                            <ul className="mt-2 space-y-1.5">
                              {block.whatIsAnalysed.map((item) => (
                                <li key={item} className="flex gap-2 text-sm text-slate-400">
                                  <span className="text-amber-500/80 flex-shrink-0">—</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              What you receive
                            </h4>
                            <ul className="mt-2 space-y-1.5">
                              {block.whatYouReceive.map((item) => (
                                <li key={item} className="flex gap-2 text-sm text-slate-400">
                                  <span className="text-amber-500/80 flex-shrink-0">—</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Why it matters
                            </h4>
                            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                              {block.whyItMatters}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/10">
                        <Link
                          href={block.href}
                          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 transition-colors"
                        >
                          {block.cta} →
                        </Link>
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ——— SAMPLE OUTPUT PREVIEW ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Output format
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                What the report includes
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                Every audit produces a structured deliverable. The format is designed to be
                defensible, confidence-aware, and decision-oriented.{" "}
                <Link href="/sample-report" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
                  View the sample report preview
                </Link>
                .
              </p>
            </ScrollReveal>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: "Structured report",
                  desc: "Clear sections: summary, domain-level analysis, evidence observations, and next-step guidance.",
                },
                {
                  title: "Scoring layer",
                  desc: "Domain-level scores and an overall scorecard, aligned with our methodology and comparable across cases.",
                },
                {
                  title: "Evidence observations",
                  desc: "What was observed in the visual evidence — donor, recipient, healing — tied to the scoring rationale.",
                },
                {
                  title: "Confidence-aware findings",
                  desc: "Explicit treatment of evidence limitations: what we can conclude with confidence vs where documentation is insufficient.",
                },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:border-white/15 transition-colors h-full">
                    <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal delay={0.15}>
              <div className="mt-10 max-w-md rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="relative aspect-[3/2] bg-slate-900/80">
                  <Image
                    src="/images/patient-report-sample.jpg"
                    alt="Sample patient forensic report"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 448px"
                  />
                </div>
                <p className="px-4 py-3 text-xs text-slate-500 border-t border-white/10">
                  Sample patient forensic report — structured scorecard, visual evidence review, confidence interpretation.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ——— CTA ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Next steps
              </h2>
              <p className="mt-4 text-slate-400 text-sm sm:text-base">
                Request an audit, learn how the platform works, explore participating clinics, or view recognition pathways.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
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
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
