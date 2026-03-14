import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import HairAuditScoreVisual from "@/components/seo/HairAuditScoreVisual";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import BetaStats from "@/components/BetaStats";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import TrackedLink from "@/components/analytics/TrackedLink";

export const revalidate = 600;
export const metadata = createPageMetadata({
  title: "HairAudit",
  description:
    "Independent hair transplant review with structured evidence, clear findings, and patient-friendly reporting.",
  pathname: "/",
});

export default function HomePage() {
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
            <ScrollReveal>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1]">
                Understand What Happened in Your Hair Transplant
              </h1>
              <p className="mt-5 text-lg text-slate-300 max-w-2xl mx-auto">
                Independent experts review your surgery and explain your results.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_review_hero"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                >
                  Request Review
                </TrackedLink>
                <TrackedLink
                  href="/sample-report"
                  eventName="cta_example_report_hero"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  See Example Report
                </TrackedLink>
              </div>
              <p className="mt-3 text-xs text-amber-300 font-medium">Independent Surgery Assessment</p>
              <p className="mt-3 text-sm text-slate-500">
                AI-assisted analysis. Expert-reviewed findings. Independent reporting.
              </p>
              <div className="max-w-2xl mx-auto mt-6 text-left">
                <ReviewProcessReassurance />
              </div>
              <p className="mt-6 text-sm text-slate-400 max-w-2xl mx-auto">
                Many patients only realise something may be wrong months after surgery. HairAudit
                helps you understand whether your result is normal — or if something went wrong.
              </p>
            </ScrollReveal>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 pb-8 sm:pb-12">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal delay={0.05}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-wider text-amber-300 font-semibold">For Patients</p>
                  <p className="mt-2 text-sm text-slate-300">Need clarity on your transplant outcome?</p>
                  <TrackedLink
                    href="/request-review"
                    eventName="cta_request_review_home_split"
                    className="mt-4 inline-flex items-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 transition-colors"
                  >
                    Request Review
                  </TrackedLink>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-wider text-cyan-300 font-semibold">For Clinics / Surgeons</p>
                  <p className="mt-2 text-sm text-slate-300">Join a professional transparency pathway.</p>
                  <TrackedLink
                    href="/professionals/apply"
                    eventName="cta_professional_apply_home_split"
                    className="mt-4 inline-flex items-center rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/5 transition-colors"
                  >
                    Apply for Participation
                  </TrackedLink>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">What HairAudit Looks At</h2>
              <ul className="mt-6 grid sm:grid-cols-2 gap-3 text-slate-300">
                {[
                  "Hairline design",
                  "Graft placement",
                  "Donor area safety",
                  "Hair density",
                  "Expected growth",
                ].map((item) => (
                  <li key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-slate-400">
                We look at both the appearance of the result and the quality of the surgical work.
              </p>
            </ScrollReveal>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">How It Works</h2>
            </ScrollReveal>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                "Upload your surgery photos",
                "Our system analyzes the images",
                "A medical expert reviews the case",
                "You receive a detailed report",
              ].map((step, i) => (
                <ScrollReveal key={step} delay={i * 0.05}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Step {i + 1}</p>
                    <p className="mt-2 text-sm text-slate-200">{step}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Why Patients Ask for a Review</h2>
              <ul className="mt-6 space-y-3 text-slate-300">
                {[
                  "Your result looks thinner than expected",
                  "Your hairline looks unnatural",
                  "Your donor area looks damaged",
                  "You want a professional second opinion",
                  "You need clear documentation of what happened",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="text-amber-400">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-slate-400">
                Not sure which concern matches your case?{" "}
                <Link href="/hair-transplant-problems" className="text-amber-400 hover:text-amber-300 transition-colors">
                  Explore Hair Transplant Problem Guides
                </Link>
                .
              </p>
            </ScrollReveal>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                Want validation, not just problem checks?
              </h2>
              <p className="mt-4 text-slate-300 max-w-3xl">
                If your result seems good and you want objective confirmation, use our score pathway.
              </p>
              <div className="mt-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-lg font-semibold text-white">How Good Is My Hair Transplant?</h3>
                  <p className="mt-3 text-sm text-slate-300">
                    Receive a structured quality score with clear explanations in patient-friendly language.
                  </p>
                  <div className="mt-5 flex flex-col sm:flex-row gap-4">
                    <Link
                      href="/rate-my-hair-transplant"
                      className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition-colors"
                    >
                      Get Your Hair Transplant Score
                    </Link>
                    <Link
                      href="/is-my-hair-transplant-normal"
                      className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                    >
                      Read Quality Guides
                    </Link>
                  </div>
                </div>
                <HairAuditScoreVisual score={89} label="Strong quality validation" />
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20" id="public-beta">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Public Beta Program</h2>
              <p className="mt-4 text-slate-300 max-w-3xl">
                HairAudit is running a public beta to refine our Follicle Intelligence™ scoring system
                with real cases and professional feedback.
              </p>
              <ul className="mt-6 space-y-3 text-slate-300">
                {[
                  "Audits are free during the beta period.",
                  "Every case gets AI analysis plus manual verification; scores are monitored and corrected when needed.",
                  "Clinics and surgeons in the program receive free access and early placement in rankings.",
                  "Beta participants help refine the global scoring system for everyone.",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="text-amber-400 shrink-0">–</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <p className="text-xs uppercase tracking-wider text-amber-300/90 font-semibold mb-4">
                  Beta at a glance
                </p>
                <BetaStats />
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Your safety and trust matter</h2>
                <p className="mt-4 text-slate-300">
                  Your photos and case details are handled securely. Every case is reviewed using a
                  structured process designed to be objective and evidence-based.
                </p>
              </div>
              <p className="mt-6 text-sm text-slate-500">
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
