import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";

type FAQItem = {
  question: string;
  answer: string;
};

type IssueEducationPageProps = {
  title: string;
  description: string;
  intro: string;
  explanations: string[];
  summaryPoints: string[];
  seekReviewPoints: string[];
  faqs: FAQItem[];
};

export default function IssueEducationPage({
  title,
  description,
  intro,
  explanations,
  summaryPoints,
  seekReviewPoints,
  faqs,
}: IssueEducationPageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <MedicalProcedureFaqSchema pageName={title} pageDescription={description} faqs={faqs} />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1 px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Patient education
            </p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">{title}</h1>
            <p className="mt-5 text-slate-300 max-w-3xl">{intro}</p>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Clear explanation</h2>
              <div className="mt-4 space-y-4 text-slate-300">
                {explanations.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Quick summary</h2>
              <ul className="mt-4 space-y-2 text-slate-300">
                {summaryPoints.map((point) => (
                  <li key={point}>- {point}</li>
                ))}
              </ul>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <section className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-6">
              <h2 className="text-xl font-semibold text-amber-100">When to seek review</h2>
              <ul className="mt-4 space-y-2 text-amber-50/90">
                {seekReviewPoints.map((point) => (
                  <li key={point}>- {point}</li>
                ))}
              </ul>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Need an independent review?</h2>
              <p className="mt-3 text-slate-300">
                HairAudit can review your photos and case timeline, then explain findings in plain
                language.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/request-review"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
                >
                  Request Hair Transplant Review
                </Link>
                <Link
                  href="/audit-examples"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  View Audit Examples
                </Link>
              </div>
              <ReviewProcessReassurance className="mt-6" />
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.25}>
            <section className="mt-10">
              <h2 className="text-xl font-semibold text-white">Common questions</h2>
              <div className="mt-4 space-y-4">
                {faqs.map((faq) => (
                  <div key={faq.question} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <h3 className="font-semibold text-white">{faq.question}</h3>
                    <p className="mt-2 text-sm text-slate-300">{faq.answer}</p>
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
