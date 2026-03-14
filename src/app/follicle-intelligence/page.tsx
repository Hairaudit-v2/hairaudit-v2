import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import CrossPlatformLink from "@/components/platform/CrossPlatformLink";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { HA_HOME } from "@/config/platform-links";

export const metadata = createPageMetadata({
  title: "Follicle Intelligence | HairAudit",
  description:
    "Explore the AI-assisted analysis layer used by HairAudit to support consistent, evidence-based transplant review.",
  pathname: "/follicle-intelligence",
});

const capabilities = [
  {
    title: "Donor Area & Follicle Analysis",
    description:
      "Advanced assessment of donor zone integrity, extraction patterns, and follicle distribution. Follicle Intelligence analyses spacing, punch impact, transection risk, and long-term donor sustainability to identify over-harvesting and depletion indicators.",
    icon: "🔬",
  },
  {
    title: "Graft Quality & Handling Assessment",
    description:
      "Objective evaluation of graft handling, survival indicators, and preservation quality. The technology assesses extraction technique, storage conditions, and implantation impact — factors that directly influence growth outcomes.",
    icon: "⚡",
  },
  {
    title: "Implantation & Hairline Design Review",
    description:
      "Structured analysis of recipient-side quality: incision angles, density distribution, hairline design, and aesthetic potential. Follicle Intelligence identifies patterns that predict natural appearance and long-term aesthetic results.",
    icon: "📐",
  },
  {
    title: "Consistent, Evidence-Based Scoring",
    description:
      "Every audit uses the same rigorous criteria, ensuring consistency across cases. The technology applies defined clinical standards so scores are transparent, comparable, and medically relevant — not subjective opinion.",
    icon: "📊",
  },
  {
    title: "Growth & Outcome Prediction",
    description:
      "Evidence-based assessment of likely growth performance, healing indicators, and outcome expectations. By correlating technique quality with clinical benchmarks, Follicle Intelligence supports realistic expectations and follow-up planning.",
    icon: "🌱",
  },
];

export default function FollicleIntelligencePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-slate-900 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal delay={0}>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                Follicle Intelligence
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-4 sm:mt-6 text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
                HairAudit delivers independent, evidence-based forensic audits. Follicle Intelligence
                supports that methodology with structured analysis, consistent criteria, and depth
                across donor, graft, and recipient assessment.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <p className="mt-2 text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
                AI-assisted analysis within an independent review framework — so objectivity and
                evidence lead, technology supports.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.3}>
              <div className="mt-8 max-w-xl mx-auto text-left">
                <CrossPlatformLink mode="follicleIntelligence" />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* What it does */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-white">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                What Follicle Intelligence Delivers
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Independent, evidence-based review comes first. Follicle Intelligence supports that
                review with structured assessment tools, consistent criteria, and analytical depth
                across donor, graft, and recipient areas.
              </p>
            </ScrollReveal>
            <div className="mt-10 sm:mt-14 space-y-6 sm:space-y-8">
              {capabilities.map((cap, i) => (
                <ScrollReveal key={cap.title} delay={i * 0.05}>
                  <div className="flex gap-4 p-5 sm:p-6 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xl">
                      {cap.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-lg">{cap.title}</h3>
                      <p className="mt-2 text-slate-600 text-sm sm:text-base">{cap.description}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Why it matters */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                Why This Technology Matters
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Hair transplant quality assessment has historically relied on subjective judgment and
                inconsistent criteria. Independent, evidence-based benchmarking — supported by structured
                analysis — changes that.
              </p>
            </ScrollReveal>
            <div className="mt-10 grid sm:grid-cols-2 gap-4 sm:gap-6">
              <ScrollReveal delay={0.05}>
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <h3 className="font-semibold text-slate-900">Objectivity</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Defined criteria and structured analysis reduce bias. Every case is assessed
                    against the same clinical standards.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <h3 className="font-semibold text-slate-900">Consistency</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Scores and findings are comparable across cases, clinics, and time — enabling
                    meaningful benchmarking and improvement tracking.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.15}>
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <h3 className="font-semibold text-slate-900">Depth</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Beyond surface-level review, our methodology supports detailed analysis of
                    donor integrity, graft quality, and implantation precision.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <h3 className="font-semibold text-slate-900">Evidence-Based</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Findings are grounded in clinical evidence and established medical standards, not
                    marketing claims or anecdotal opinion.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 sm:px-6 py-12 sm:py-16 bg-slate-900 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold">
                Request an independent forensic audit
              </h2>
              <p className="mt-4 text-slate-300 text-sm sm:text-base">
                Independent, evidence-based review. Analysis assisted by Follicle Intelligence.
              </p>
              <Link
                href={`${HA_HOME}/signup`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 sm:mt-8 inline-flex items-center justify-center px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors text-base"
              >
                Submit your case
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
