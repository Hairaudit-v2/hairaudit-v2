import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "How It Works | HairAudit",
  description:
    "See how HairAudit reviews surgery photos with structured analysis, expert review, and clear reporting.",
  pathname: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(56,189,248,0.04),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Hero: no ScrollReveal so LCP (H1/CTA) paints immediately */}
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1]">
              How HairAudit Reviews Your Surgery
            </h1>
            <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              We use your photos and case details to build a clear, independent review.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/request-review"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                Request Review
              </Link>
              <Link
                href="/demo-report"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                See Example Report
              </Link>
            </div>
            <p className="mt-3 text-xs text-amber-300 font-medium">Independent Surgery Assessment</p>
            <div className="max-w-2xl mx-auto mt-6 text-left">
              <ReviewProcessReassurance />
            </div>
            <p className="mt-4 text-sm text-slate-400 max-w-2xl mx-auto">
              Many patients only realise something may be wrong months after surgery. HairAudit
              helps you understand whether your result is normal — or if something went wrong.
            </p>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto">
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Step-by-step
            </h2>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                "Upload your surgery photos",
                "Our system analyzes the images",
                "A medical expert reviews the case",
                "You receive a detailed report",
              ].map((step, i) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Step {i + 1}
                  </p>
                  <p className="mt-2 text-sm text-slate-200">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
              What happens after your review
            </h2>
            <p className="mt-4 text-slate-400">
              Your report explains what looks well supported, where confidence is limited, and what
              next steps may help.
            </p>
            <p className="mt-5 text-sm text-slate-500">
              Looking for our technical standards?{" "}
              <Link href="/professionals" className="text-amber-400 hover:text-amber-300 transition-colors">
                For Professionals
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Move from uncertainty to structured evidence
            </h2>
            <p className="mt-4 text-slate-400">
              Choose the next entry point based on what you need now.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
              <Link href="/request-review" className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20">
                Request Review
              </Link>
              <Link href="/demo-report" className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors">
                See Example Report
              </Link>
            </div>
            <div className="max-w-2xl mx-auto mt-6 text-left">
              <ReviewProcessReassurance />
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Looking for our technical standards?{" "}
              <Link href="/professionals" className="text-amber-400 hover:text-amber-300 transition-colors">
                For Professionals
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
