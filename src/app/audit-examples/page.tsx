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
    question: "Are these real patient reports?",
    answer:
      "This library uses redacted and educational examples. Private patient data is not published.",
  },
  {
    question: "Why should I review examples first?",
    answer:
      "Examples help you understand report language, evidence limits, and how decisions are supported.",
  },
  {
    question: "Can examples predict my own result?",
    answer:
      "No. Every case is different. Examples show format and method, not personal medical outcomes.",
  },
];

export const metadata = createPageMetadata({
  title: "Audit Examples | HairAudit",
  description:
    "Explore educational audit examples, report sections, and patient concern guides to understand HairAudit methodology and trust signals.",
  pathname: "/audit-examples",
});

export default function AuditExamplesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <MedicalProcedureFaqSchema
        pageName="Hair Transplant Audit Examples Library"
        pageDescription="Educational library of report examples and patient concern explainers."
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
              Audit Examples Library
            </h1>
            <p className="mt-4 text-slate-300 max-w-3xl">
              Review sample structures and common concern guides before you submit. This library is
              designed for trust, transparency, and easy understanding.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Core report example</h2>
              <p className="mt-3 text-slate-300">
                See how a full review is organized: summary, evidence status, scores, findings, and
                next-step context.
              </p>
              <div className="mt-5">
                <Link
                  href="/sample-report"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  See Example Report
                </Link>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-white">Patient concern guides</h2>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                {patientIssueLibrary.map((issue) => (
                  <Link
                    key={issue.slug}
                    href={`/${issue.slug}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-amber-300/60 transition-colors"
                  >
                    <h3 className="font-semibold text-white">{issue.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{issue.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Ready to submit your case?</h2>
              <p className="mt-3 text-slate-300">
                Submit photos and case details for independent review with clear, plain-language
                reporting.
              </p>
              <div className="mt-5">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/request-review"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
                  >
                    Request Review
                  </Link>
                  <Link
                    href="/rate-my-hair-transplant"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                  >
                    Get Your Hair Transplant Score
                  </Link>
                </div>
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
