import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import HairAuditScoreVisual from "@/components/seo/HairAuditScoreVisual";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import { validationFunnelPages } from "@/lib/validationFunnelPages";
import RateMyHairTransplantClient from "@/components/community/RateMyHairTransplantClient";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

const faqs = [
  {
    question: "Is this only for patients with problems?",
    answer:
      "No. This pathway is for patients who want independent validation of a good or normal-looking result.",
  },
  {
    question: "What score do I receive?",
    answer:
      "You receive a simplified HairAudit Score summary plus a structured report with findings and confidence context.",
  },
  {
    question: "Can I share my score online?",
    answer:
      "Yes. Share your score summary while removing identifying details from photos to protect privacy.",
  },
];

export const metadata = createPageMetadata({
  title: "How Good Is My Hair Transplant? | HairAudit",
  description:
    "Get an independent HairAudit quality score to validate your hair transplant result with structured, evidence-based review.",
  pathname: "/rate-my-hair-transplant",
});

export default function RateMyHairTransplantPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <MedicalProcedureFaqSchema
        pageName="How Good Is My Hair Transplant?"
        pageDescription="Independent transplant quality validation and structured scoring."
        faqs={faqs}
      />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1 px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              How Good Is My Hair Transplant?
            </h1>
            <p className="mt-5 text-slate-300 max-w-3xl">
              HairAudit can evaluate transplant quality and provide a structured score. This is for
              patients who want confirmation and objective documentation, not only those with concerns.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <section className="mt-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">What your score reflects</h2>
                <ul className="mt-4 space-y-2 text-slate-300">
                  <li>- Hairline design and natural appearance signals</li>
                  <li>- Density pattern and graft placement quality</li>
                  <li>- Donor area preservation and long-term safety indicators</li>
                  <li>- Evidence confidence based on your submitted timeline</li>
                </ul>
                <p className="mt-4 text-sm text-slate-300">
                  Your simplified summary includes: Hairline Design, Density, Donor Preservation,
                  Naturalness, and Overall Score.
                </p>
              </div>
              <HairAuditScoreVisual score={88} label="Strong quality validation" />
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.08}>
            <RateMyHairTransplantClient />
          </ScrollReveal>

          <ScrollReveal delay={0.09}>
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">What happens next</h2>
              <ol className="mt-4 space-y-2 text-slate-300 text-sm">
                <li>- Submit your photos and timeline details.</li>
                <li>- We process the case through the HairAudit scoring flow.</li>
                <li>- Your evidence is assessed with structured quality interpretation.</li>
                <li>- You receive score and next-step guidance.</li>
              </ol>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <section className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-6">
              <h2 className="text-xl font-semibold text-cyan-100">Share your score with privacy in mind</h2>
              <p className="mt-3 text-cyan-50/90">
                If you post your HairAudit Score on social media, share the summary card only and hide
                personal identifiers.
              </p>
              <ul className="mt-4 space-y-2 text-cyan-50/90">
                <li>- Remove face and tattoos before posting images.</li>
                <li>- Share score summary, not full private report details.</li>
                <li>- Keep procedure dates and private clinic notes confidential.</li>
              </ul>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-white">Explore quality education pages</h2>
              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {validationFunnelPages.map((page) => (
                  <Link
                    key={page.slug}
                    href={`/${page.slug}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-emerald-300/60 transition-colors"
                  >
                    <h3 className="font-semibold text-white">{page.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{page.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Need independent reassurance?</h2>
              <p className="mt-3 text-slate-300">
                Submit your timeline and receive a score plus structured findings you can keep for your records.
              </p>
              <p className="mt-4 text-sm text-slate-300">Use the upload form above to generate your score.</p>
              <ReviewProcessReassurance className="mt-6" />
            </section>
          </ScrollReveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
