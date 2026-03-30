import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";
import { listPatientIntentGuidesGroupedByTheme } from "@/lib/seo/patient-intent-hub-themes";

const faqs = [
  {
    question: "Are all transplant concerns signs of surgical failure?",
    answer:
      "No. Some concerns are part of normal recovery. A timeline-based, independent review helps separate expected healing from issues that deserve closer attention.",
  },
  {
    question: "What do these guides cover?",
    answer:
      "Plain-language explainers on common post-transplant worries, how photos and timelines are used in assessment, donor and design trade-offs, and when an independent HairAudit review is most useful.",
  },
  {
    question: "When should I request an independent review?",
    answer:
      "When worry persists after a fair healing window, clinic explanations do not match what you see in consistent photos, or you want structured documentation before a complaint, second opinion, or revision plan.",
  },
];

export const metadata = createPageMetadata({
  title: "Hair Transplant Patient Guides | Independent Education | HairAudit",
  description:
    "Evidence-based patient guides on hair transplant results, timelines, donor safety, photos, and when an independent HairAudit review helps—without clinic marketing.",
  pathname: "/hair-transplant-problems",
});

function GuideCard({
  href,
  title,
  description,
  linkLabel,
}: {
  href: string;
  title: string;
  description: string;
  linkLabel: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-amber-300/60 transition-colors flex flex-col h-full"
    >
      <h3 className="text-lg font-semibold text-white leading-snug">{title}</h3>
      <p className="mt-3 text-sm text-slate-300 leading-relaxed flex-1 line-clamp-4">{description}</p>
      <p className="mt-4 text-sm font-medium text-amber-300">{linkLabel}</p>
    </Link>
  );
}

export default function HairTransplantProblemsHubPage() {
  const themedSections = listPatientIntentGuidesGroupedByTheme();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <MedicalProcedureFaqSchema
        pageName="Hair transplant patient guides"
        pageDescription="Independent patient education on post-transplant concerns, photo-based review, and when structured assessment helps."
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
            <nav className="mb-6" aria-label="Breadcrumb">
              <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Home
              </Link>
              <span className="text-slate-600 mx-2">/</span>
              <span className="text-sm text-slate-400">Patient guides</span>
            </nav>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Independent patient education</p>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-[2.25rem] font-bold text-white tracking-tight leading-tight">
              Hair transplant patient guides
            </h1>
            <p className="mt-5 text-lg text-slate-300 max-w-3xl leading-relaxed">
              Worried about density, hairline shape, donor thinning, or slow growth? These guides explain what often drives those concerns, what can still be normal during recovery, and{" "}
              <span className="text-slate-200">where an independent, photo-based HairAudit review fits</span>—separate from any clinic’s sales story.
            </p>
            <p className="mt-4 text-slate-400 max-w-3xl leading-relaxed">
              Use the short topic pages for a fast orientation, then open the in-depth guides grouped by theme. Every guide is written in the same evidence-aware voice as our reports.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                href="/request-review"
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
              >
                Request an independent review
              </Link>
              <Link
                href="/sample-report"
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                View a sample report
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                FAQ
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.04}>
            <section className="mt-14" aria-labelledby="quick-topics-heading">
              <h2 id="quick-topics-heading" className="text-xl font-semibold text-white">
                Quick topic guides
              </h2>
              <p className="mt-3 text-slate-400 max-w-3xl text-sm sm:text-base leading-relaxed">
                Shorter pages on frequent search questions. Pair them with the themed guides below when you want more depth.
              </p>
              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                {patientIssueLibrary.map((issue) => (
                  <GuideCard
                    key={issue.slug}
                    href={`/${issue.slug}`}
                    title={issue.title}
                    description={issue.description}
                    linkLabel="Open quick guide"
                  />
                ))}
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.06}>
            <section className="mt-16" aria-labelledby="in-depth-heading">
              <h2 id="in-depth-heading" className="text-xl font-semibold text-white">
                In-depth guides by theme
              </h2>
              <p className="mt-3 text-slate-400 max-w-3xl text-sm sm:text-base leading-relaxed">
                Longer reads organised into clusters so you can explore one concern without losing the surrounding context—healing versus design versus donor planning versus independent review.
              </p>
            </section>
          </ScrollReveal>

          {themedSections.map((section, idx) => (
            <ScrollReveal key={section.id} delay={0.07 + idx * 0.02}>
              <section className="mt-12 scroll-mt-24" aria-labelledby={`theme-${section.id}`}>
                <h3 id={`theme-${section.id}`} className="text-lg sm:text-xl font-semibold text-white">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl leading-relaxed">{section.description}</p>
                <div className="mt-5 grid sm:grid-cols-2 gap-4">
                  {section.guides.map((guide) => (
                    <GuideCard
                      key={guide.slug}
                      href={guide.pathname}
                      title={guide.h1}
                      description={guide.metaDescription}
                      linkLabel="Read full guide"
                    />
                  ))}
                </div>
              </section>
            </ScrollReveal>
          ))}

          <ScrollReveal delay={0.2}>
            <section className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Want example findings, not theory?</h2>
              <p className="mt-3 text-slate-300 leading-relaxed">
                The audit example library shows how structured findings, evidence limits, and next steps appear in practice.
              </p>
              <div className="mt-5">
                <Link
                  href="/audit-examples"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Browse audit examples
                </Link>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.22}>
            <section className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-6">
              <h2 className="text-xl font-semibold text-emerald-100">Happy with your result and want validation?</h2>
              <p className="mt-3 text-emerald-50/90 leading-relaxed">
                Use the dedicated quality pathway for objective confirmation and a shareable score.
              </p>
              <div className="mt-5">
                <Link
                  href="/rate-my-hair-transplant"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition-colors"
                >
                  How good is my hair transplant?
                </Link>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.24}>
            <section className="mt-8 rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-500/10 to-transparent p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-white">Ready for structured, independent assessment?</h2>
              <p className="mt-3 text-slate-300 leading-relaxed">
                If something still feels off after reading, submit photos and timeline for a medical review that does not depend on your clinic’s narrative. Preview a{" "}
                <Link href="/sample-report" className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2">
                  sample HairAudit report
                </Link>{" "}
                or read the{" "}
                <Link href="/faq" className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2">
                  FAQ
                </Link>{" "}
                first if that helps.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
                <Link
                  href="/request-review"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
                >
                  Request an independent review
                </Link>
                <Link
                  href="/sample-report"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  View a sample report
                </Link>
                <Link
                  href="/faq"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  FAQ
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
