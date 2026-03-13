import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import HairAuditScoreVisual from "@/components/seo/HairAuditScoreVisual";

type ValidationEducationPageProps = {
  title: string;
  description: string;
  intro: string;
  excellentSignals: string[];
  highQualityExamples: string[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
  suggestedScore: number;
};

export default function ValidationEducationPage({
  title,
  description,
  intro,
  excellentSignals,
  highQualityExamples,
  faq,
  suggestedScore,
}: ValidationEducationPageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <MedicalProcedureFaqSchema pageName={title} pageDescription={description} faqs={faq} />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1 px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Quality validation
            </p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">{title}</h1>
            <p className="mt-5 text-slate-300 max-w-3xl">{intro}</p>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <section className="mt-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">What excellent results usually show</h2>
                <ul className="mt-4 space-y-2 text-slate-300">
                  {excellentSignals.map((signal) => (
                    <li key={signal}>- {signal}</li>
                  ))}
                </ul>
              </div>
              <HairAuditScoreVisual score={suggestedScore} />
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Examples of high quality outcomes</h2>
              <ul className="mt-4 space-y-2 text-slate-300">
                {highQualityExamples.map((example) => (
                  <li key={example}>- {example}</li>
                ))}
              </ul>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <section className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-6">
              <h2 className="text-xl font-semibold text-cyan-100">Share your score safely</h2>
              <p className="mt-3 text-cyan-50/90">
                You can share your HairAudit Score card on social media while keeping private details
                hidden. We recommend removing your face, tattoos, and personal identifiers before posting.
              </p>
              <ul className="mt-4 space-y-2 text-cyan-50/90">
                <li>- Share the summary score and overall findings only.</li>
                <li>- Avoid posting full-resolution close-ups with identifiable marks.</li>
                <li>- Keep private timeline details in your full report, not public posts.</li>
              </ul>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Get your structured score</h2>
              <p className="mt-3 text-slate-300">
                HairAudit can evaluate transplant quality using a consistent scoring framework.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/request-review"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
                >
                  Get Your Hair Transplant Score
                </Link>
                <Link
                  href="/audit-examples"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Browse Audit Examples
                </Link>
              </div>
              <ReviewProcessReassurance className="mt-6" />
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.25}>
            <section className="mt-10">
              <h2 className="text-xl font-semibold text-white">Common questions</h2>
              <div className="mt-4 space-y-4">
                {faq.map((item) => (
                  <div key={item.question} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <h3 className="font-semibold text-white">{item.question}</h3>
                    <p className="mt-2 text-sm text-slate-300">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </ScrollReveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
