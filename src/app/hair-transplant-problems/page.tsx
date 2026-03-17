import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

const faqs = [
  {
    question: "Are all transplant concerns signs of surgical failure?",
    answer:
      "No. Some concerns are part of normal recovery. A timeline-based review helps separate expected healing from true quality issues.",
  },
  {
    question: "What is the benefit of reading these pages?",
    answer:
      "They help you understand common warning signs in plain language before you decide whether to request a review.",
  },
  {
    question: "When should I request a review?",
    answer:
      "Request a review when concern persists, communication is unclear, or you need independent documentation for next-step decisions.",
  },
];

export const metadata = createPageMetadata({
  title: "Hair Transplant Problems | HairAudit",
  description:
    "SEO hub covering common hair transplant problems, warning signs, and when to request an independent HairAudit review.",
  pathname: "/hair-transplant-problems",
});

export default function HairTransplantProblemsHubPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <MedicalProcedureFaqSchema
        pageName="Hair Transplant Problems: Patient Education Hub"
        pageDescription="Education hub for common post-transplant concerns and independent review guidance."
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
              Hair Transplant Problems: Education Hub
            </h1>
            <p className="mt-4 text-slate-300 max-w-3xl">
              If your result looks unusual, you are not alone. This hub explains common concerns
              in simple language, when those concerns may be normal, and when independent review is
              helpful.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <section className="mt-10 grid sm:grid-cols-2 gap-4">
              {patientIssueLibrary.map((issue) => (
                <Link
                  key={issue.slug}
                  href={`/${issue.slug}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-amber-300/60 transition-colors"
                >
                  <h2 className="text-lg font-semibold text-white">{issue.title}</h2>
                  <p className="mt-3 text-sm text-slate-300">{issue.description}</p>
                  <p className="mt-4 text-sm font-medium text-amber-300">Read guide</p>
                </Link>
              ))}
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Need examples of structured findings?</h2>
              <p className="mt-3 text-slate-300">
                Visit our audit example library to understand how findings, evidence limits, and next
                steps are presented.
              </p>
              <div className="mt-5">
                <Link
                  href="/audit-examples"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Browse Audit Examples
                </Link>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.12}>
            <section className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-6">
              <h2 className="text-xl font-semibold text-emerald-100">Result looks good and you want validation?</h2>
              <p className="mt-3 text-emerald-50/90">
                Use our dedicated quality pathway for patients seeking objective confirmation and a shareable score.
              </p>
              <div className="mt-5">
                <Link
                  href="/rate-my-hair-transplant"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition-colors"
                >
                  How Good Is My Hair Transplant?
                </Link>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Request your independent review</h2>
              <p className="mt-3 text-slate-300">
                If concern remains after reading these guides, submit your case for a structured
                medical review.
              </p>
              <div className="mt-5">
                <Link
                  href="/request-review"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
                >
                  Request Review
                </Link>
              </div>
              <ReviewProcessReassurance className="mt-6" />
            </section>
          </ScrollReveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
