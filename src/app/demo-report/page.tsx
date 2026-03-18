import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import TrackedLink from "@/components/analytics/TrackedLink";
import DemoReportCtaLinks from "./DemoReportCtaLinks";

export const metadata = createPageMetadata({
  title: "Sample Report | HairAudit",
  description:
    "View the structure and depth of a HairAudit AI surgical analysis report. Sample content only — no patient data. Request a full audit for your case.",
  pathname: "/demo-report",
});

export default function DemoReportPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(34,211,238,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_35%_at_88%_20%,rgba(129,140,248,0.08),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        <section className="px-4 sm:px-6 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <ScrollReveal>
              <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Sample report — no patient data
              </p>
              <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                HairAudit Sample Report
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
                See the structure and depth of a full HairAudit AI surgical analysis. This sample uses
                illustrative data only; real reports are generated from your submitted case evidence.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <DemoReportCtaLinks />
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-12">
          <div className="mx-auto max-w-5xl">
            <ScrollReveal>
              <div className="rounded-2xl border border-white/12 bg-white/[0.03] overflow-hidden backdrop-blur">
                <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Preview
                  </span>
                  <div className="flex gap-2">
                    <a
                      href="/api/print/demo-report"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      Open in new tab
                    </a>
                    <a
                      href="/api/reports/demo-pdf"
                      className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
                <iframe
                  title="HairAudit sample report"
                  src="/api/print/demo-report"
                  className="w-full h-[720px] sm:h-[840px] bg-white border-0"
                />
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl rounded-3xl border border-cyan-300/25 bg-gradient-to-r from-cyan-400/10 via-indigo-400/10 to-slate-900 p-8 text-center shadow-2xl shadow-cyan-950/30">
            <ScrollReveal>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Next steps</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Request an Audit · Book a Demo · Create a Clinic Profile
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-slate-200">
                Get a full report for your case, see the platform for your clinic, or join the HairAudit network.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_audit_demo_page"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Request an Audit
                </TrackedLink>
                <TrackedLink
                  href="/request-review"
                  eventName="cta_book_demo_demo_page"
                  className="inline-flex items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-300/15 px-6 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/25"
                >
                  Book a Demo
                </TrackedLink>
                <TrackedLink
                  href="/professionals"
                  eventName="cta_clinic_profile_demo_page"
                  className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Create a Clinic Profile
                </TrackedLink>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
