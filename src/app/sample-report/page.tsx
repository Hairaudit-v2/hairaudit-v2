// HairAudit Sample Report — output proof, methodology proof (no private data)
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import TrackedLink from "@/components/analytics/TrackedLink";

export const metadata = createPageMetadata({
  title: "Sample Report | HairAudit",
  description:
    "See a redacted HairAudit report format with structured findings, confidence notes, and next-step guidance.",
  pathname: "/sample-report",
});

const reportPanels = [
  {
    id: "summary",
    title: "Forensic Summary",
    content:
      "A concise executive summary of the case: procedure context, evidence reviewed, and overall assessment. Quality indicators and limitations are stated explicitly. No vague language — conclusions are tied to the evidence presented.",
  },
  {
    id: "evidence",
    title: "Evidence Status",
    content:
      "What documentation was available and how it supports the audit. Donor views, recipient views, timeline, and procedural detail. Gaps in evidence are listed so the reader understands where confidence is lower.",
  },
  {
    id: "scores",
    title: "Your Surgery Score Breakdown",
    content:
      "Your report shows a clear score breakdown across key parts of surgery quality. Each score includes a plain-language explanation and the evidence used.",
  },
  {
    id: "confidence",
    title: "Confidence Interpretation",
    content:
      "Where the evidence supports a confident conclusion and where it does not. We distinguish between quality concerns (evidence suggests an issue) and evidence limitations (we cannot conclude because key views or data are missing).",
  },
  {
    id: "findings",
    title: "Findings & Observations",
    content:
      "Domain-by-domain observations: what was observed in the visual evidence, how it relates to the scoring, and what it implies for outcome potential. Written for clarity and traceability, not marketing.",
  },
  {
    id: "recommendations",
    title: "Recommendations / Next-Step Considerations",
    content:
      "Actionable guidance where appropriate: follow-up timing, additional documentation that would strengthen the assessment, corrective or remedial considerations, or reassurance when the evidence supports it. No overclaim — only what the evidence justifies.",
  },
];

const whatReportHelps = [
  "What appears well supported by the available evidence — and what does not.",
  "Where confidence is limited due to missing or insufficient documentation.",
  "What concerns may justify further documentation or correction planning.",
  "How benchmark or transparency context may apply (e.g. for participating clinics or surgeons).",
];

const whoOutputUseful = [
  {
    who: "Patients",
    desc: "Structured, independent view of procedure quality and outcome potential. May assist in understanding next steps, corrective options, or reassurance when the evidence supports it.",
  },
  {
    who: "Clinics",
    desc: "Benchmark-oriented feedback and documentation quality insight. May assist in quality improvement and transparency participation within the HairAudit ecosystem.",
  },
  {
    who: "Surgeons",
    desc: "Evidence-based performance view and recognition-readiness context. May assist in understanding how documented cases contribute to transparency and recognition tiers.",
  },
  {
    who: "Advisors / corrective support",
    desc: "Independent, structured documentation of quality and evidence. May assist in structuring independent documentation for corrective, legal, or second-opinion contexts. Not a substitute for legal or medical advice.",
  },
];

export default function SampleReportPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(56,189,248,0.04),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        {/* ——— 1. HERO ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Output proof
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1]">
                What a HairAudit output looks like
              </h1>
              <p className="mt-6 text-lg text-slate-400 leading-relaxed">
                Structured, evidence-based reporting designed to help users understand transplant
                quality, documentation strength, and next-step considerations. The content below is
                redacted and illustrative — no private patient information is shown.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ——— 2. REPORT PREVIEW PANELS ——— */}
        <section className="relative px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Report structure
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Key report sections
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                Each deliverable follows a consistent format. These panels describe the sections
                and the kind of content they contain — not actual case data.
              </p>
            </ScrollReveal>
            <div className="mt-10 space-y-4">
              {reportPanels.map((panel, i) => (
                <ScrollReveal key={panel.id} delay={i * 0.04}>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden shadow-xl shadow-black/20">
                    <div className="border-b border-white/10 px-4 sm:px-6 py-3 flex items-center gap-2">
                      <span className="size-2 rounded-full bg-amber-500/80" aria-hidden />
                      <h3 className="font-semibold text-white text-sm sm:text-base">
                        {panel.title}
                      </h3>
                    </div>
                    <div className="px-4 sm:px-6 py-4 sm:py-5">
                      <p className="text-sm text-slate-400 leading-relaxed">{panel.content}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 3. WHAT THE REPORT HELPS YOU UNDERSTAND ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Decision support
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                What the report helps you understand
              </h2>
            </ScrollReveal>
            <ul className="mt-8 space-y-4">
              {whatReportHelps.map((item, i) => (
                <ScrollReveal key={i} delay={i * 0.05}>
                  <li className="flex gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 sm:px-5 py-4">
                    <span className="size-1.5 rounded-full bg-amber-500/80 mt-2 flex-shrink-0" aria-hidden />
                    <span className="text-slate-300 text-sm sm:text-base leading-relaxed">{item}</span>
                  </li>
                </ScrollReveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ——— 4. WHO THIS OUTPUT IS USEFUL FOR ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Audience
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Who this output is useful for
              </h2>
              <p className="mt-4 text-slate-400 max-w-2xl">
                Careful, structured language. We do not make legal or medical claims; the report may
                assist in structuring independent documentation and decision-making.
              </p>
            </ScrollReveal>
            <div className="mt-12 grid sm:grid-cols-2 gap-6">
              {whoOutputUseful.map((card, i) => (
                <ScrollReveal key={card.who} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-white/15 transition-colors">
                    <h3 className="font-semibold text-white text-lg">{card.who}</h3>
                    <p className="mt-3 text-sm text-slate-400 leading-relaxed">{card.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 5. CTA ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Next steps
              </h2>
              <p className="mt-4 text-slate-400 text-sm sm:text-base">
                Choose your next step: request your review or explore the professional standards pathway.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_review_sample_report"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                >
                  Request Review
                </TrackedLink>
                <TrackedLink
                  href="/professionals"
                  eventName="cta_for_professionals_sample_report"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  For Professionals
                </TrackedLink>
              </div>
              <div className="mt-8 text-left">
                <ReviewProcessReassurance />
              </div>
              <p className="mt-5 text-sm text-slate-400">
                Many patients only realise something may be wrong months after surgery. HairAudit
                helps you understand whether your result is normal — or if something went wrong.
              </p>
              <p className="mt-5 text-sm text-slate-500">
                Looking for our technical standards?{" "}
                <Link href="/professionals" className="text-amber-400 hover:text-amber-300 transition-colors">
                  For Professionals
                </Link>
                .
              </p>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
