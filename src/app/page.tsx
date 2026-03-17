import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import SampleAuditReportSection from "@/components/landing/SampleAuditReportSection";
import HairIntelligenceEcosystemSection from "@/components/landing/HairIntelligenceEcosystemSection";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import TrackedLink from "@/components/analytics/TrackedLink";

export const revalidate = 600;
export const metadata = createPageMetadata({
  title: "HairAudit",
  description:
    "Independent hair transplant audit. Get a clear, evidence-based assessment of your surgery and understand your result.",
  pathname: "/",
});

const OUTPUT_ITEMS = [
  "An overall HairAudit Score and domain breakdown",
  "Structured findings with evidence from your photos",
  "Plain-language next-step guidance",
  "A report you can use for follow-up or second opinions",
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-slate-900">
      <SiteHeader variant="light" />

      <main id="main-content" className="relative flex-1">
        {/* 1. Hero */}
        <section className="relative px-4 sm:px-6 pt-16 sm:pt-20 pb-20 sm:pb-28 lg:pt-24 lg:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
                Independent hair transplant audit
              </p>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.08]">
                Know what really happened in your surgery.
              </h1>
              <p className="mt-6 text-xl text-slate-600 max-w-xl mx-auto leading-relaxed">
                We review your procedure with a structured, evidence-based score and clear findings — so you get an honest assessment, not marketing.
              </p>
              <div className="mt-12">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_get_surgery_audited_hero"
                  className="inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold text-lg hover:bg-amber-600 transition-colors border border-amber-600/20"
                >
                  Get Your Surgery Audited
                </TrackedLink>
              </div>
              <p className="mt-8 text-sm text-slate-500">
                <Link href="/sample-report" className="text-amber-700 hover:text-amber-800 font-medium transition-colors">
                  See an example report
                </Link>
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 2. Problem */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-200">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                The problem
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Hair transplant outcomes are rarely transparent.
              </h2>
              <p className="mt-5 text-slate-600 leading-relaxed text-lg">
                Patients often don’t know whether their result is normal, suboptimal, or a sign of poor technique. Clinics mark their own homework. There’s no independent standard to tell you what you actually received — until now.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 3. Solution */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-200">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                The solution
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                HairAudit’s scoring system.
              </h2>
              <p className="mt-5 text-slate-600 leading-relaxed text-lg">
                We apply the same evidence-based criteria to every case: design, technique, density, donor safety, and documentation. No marketing. No favour to any clinic. Just a consistent, medically grounded assessment you can trust.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 4. Output — card-based, emphasis on reports/scoring */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-200 bg-white">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                What you receive
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                A clear audit, not a sales pitch.
              </h2>
              <div className="mt-10 grid sm:grid-cols-2 gap-4">
                {OUTPUT_ITEMS.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-neutral-50/80 p-5 sm:p-6 flex gap-4"
                  >
                    <span className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700 font-semibold text-sm">
                      –
                    </span>
                    <p className="text-slate-700 leading-relaxed pt-0.5">{item}</p>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-slate-600 text-base">
                Every case is AI-assisted and then verified by a clinical reviewer before release. We do not perform surgery or promote clinics.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Ecosystem — after value prop, before product/detail; dark premium block */}
        <HairIntelligenceEcosystemSection />

        {/* Sample Audit Report — preview of what you get */}
        <SampleAuditReportSection theme="light" showCta={true} />

        {/* 5. Who it's for — cards */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                Who it’s for
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Patients and clinics — separate paths.
              </h2>
              <div className="mt-12 grid sm:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-8">
                  <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">Patients</p>
                  <p className="mt-4 text-slate-600 leading-relaxed">
                    You had a transplant and want an independent view of your result. Get clarity on quality, donor safety, and what to do next.
                  </p>
                  <TrackedLink
                    href="/request-review"
                    eventName="cta_patient_request_home"
                    className="mt-6 inline-flex items-center rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-600 transition-colors border border-amber-600/20"
                  >
                    Get Your Surgery Audited
                  </TrackedLink>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-8">
                  <p className="text-xs uppercase tracking-wider text-slate-600 font-semibold">Clinics & surgeons</p>
                  <p className="mt-4 text-slate-600 leading-relaxed">
                    You want to participate in a transparency pathway with evidence-based benchmarking and documented methodology.
                  </p>
                  <TrackedLink
                    href="/professionals/apply"
                    eventName="cta_professional_apply_home"
                    className="mt-6 inline-flex items-center rounded-xl border-2 border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                  >
                    Apply for participation
                  </TrackedLink>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* 7. Authority */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-200 bg-white">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                Authority
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Expert-led, clinically grounded.
              </h2>
              <p className="mt-5 text-slate-600 leading-relaxed text-lg">
                HairAudit is led by Paul Green, with clinical and methodological oversight to ensure every audit meets a consistent, evidence-based standard. Our process is built for medical clarity — not opinion, not marketing.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 8. Final CTA */}
        <section className="relative px-4 sm:px-6 py-24 sm:py-28 border-t border-slate-200">
          <div className="max-w-2xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                Ready for an honest assessment?
              </h2>
              <p className="mt-5 text-xl text-slate-600">
                Submit your surgery photos and details. We’ll deliver a clear audit and next-step guidance.
              </p>
              <div className="mt-10">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_get_surgery_audited_final"
                  className="inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold text-lg hover:bg-amber-600 transition-colors border border-amber-600/20"
                >
                  Get Your Surgery Audited
                </TrackedLink>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter theme="light" />
    </div>
  );
}
