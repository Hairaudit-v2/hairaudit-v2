import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { GeoContextLine } from "@/components/patient-education/GeoContentBlocks";

export const metadata = createPageMetadata({
  title: "Hair Transplant Audit Methodology | Independent Forensic Review | HairAudit",
  description:
    "How HairAudit conducts independent hair transplant audits: donor area, growth, density, design, implantation, and technique—AI-assisted analysis with clinical review, confidence-aware reporting, and clear limits.",
  pathname: "/methodology",
});

export default function MethodologyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Audit methodology", pathname: "/methodology" },
        ]}
      />
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(56,189,248,0.04),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto">
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
              Hair transplant audit methodology
            </h1>
            <p className="mt-6 text-lg text-slate-400 leading-relaxed">
              HairAudit uses your photos and case details in an independent, evidence-based forensic audit—structured
              like a second opinion across donor stewardship, recipient growth and density, design and naturalness visible
              in photos, implantation cues images can support, and explicit confidence when documentation is incomplete.
              AI-assisted analysis supports clinical reviewers. Reports explain what the evidence supports, where
              confidence is limited, and practical next steps—the output is structured documentation, not a sales
              assessment and not a substitute for in-person medical diagnosis or a treatment prescription.
            </p>
            <GeoContextLine label="How this differs from a typical clinic opinion">
              <p>
                A clinic that performed the procedure can offer useful operative context, but it also has a different
                position when interpreting the same result. HairAudit does not sell surgery or promote clinics; the audit
                is framed to describe what the submitted evidence appears to show, where conclusions are strong, and
                where they are limited. For a patient-facing comparison, read{" "}
                <Link
                  href="/hair-transplant-second-opinion-vs-clinic-opinion"
                  className="text-amber-400 hover:text-amber-300 font-medium"
                >
                  second opinion vs clinic opinion
                </Link>
                .
              </p>
            </GeoContextLine>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
              What we look at
            </h2>
            <ul className="mt-6 space-y-3 text-slate-300">
              {[
                "Donor area integrity, extraction pattern, and overharvesting risk",
                "Recipient density, growth pattern, and cosmetic design (e.g. hairline framing)",
                "Implantation angles, direction, and technique-related cues visible in photos",
                "Evidence quality, timeline fit, and confidence for each part of the audit",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-amber-400">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-slate-400">
              This is structured forensic assessment against defined criteria—not a promotional clinic assessment.
            </p>
            <GeoContextLine label="What photos and a remote audit cannot replace">
              <p>
                No photo set proves every microscopic detail of graft handling or exact survival rates. HairAudit states
                those limits directly and uses confidence scoring so you can see where evidence is complete vs thin.
                Scope and boundaries are also summarized in{" "}
                <Link
                  href="/what-an-independent-hair-transplant-audit-can-and-cannot-do"
                  className="text-amber-400 hover:text-amber-300 font-medium"
                >
                  what an independent hair transplant audit can and cannot do
                </Link>{" "}
                and{" "}
                <Link href="/can-a-hair-transplant-be-audited-from-photos" className="text-amber-400 hover:text-amber-300 font-medium">
                  auditing from photos
                </Link>
                .
              </p>
            </GeoContextLine>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Confidence in your report
            </h2>
            <p className="mt-4 text-slate-400">
              Some cases have strong photo evidence. Others have missing images. HairAudit explains
              this clearly so you know how confident each conclusion is.
            </p>
            <p className="mt-4 text-slate-400">
              Looking for technical standards, scoring, and evidence rules? See{" "}
              <Link href="/professionals" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                independent hair transplant audit standards for professionals
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Next steps
            </h2>
            <p className="mt-4 text-slate-400 text-sm sm:text-base">
              Request your review, see an example report, or learn how the process works.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
              <Link
                href="/request-review"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                Request a hair transplant audit
              </Link>
              <Link
                href="/demo-report"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                Sample hair transplant audit report
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                Hair transplant audit FAQ
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                How hair transplant audits work
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-400">
              For process detail, see{" "}
              <Link href="/how-it-works" className="text-amber-400 hover:text-amber-300">
                how hair transplant audits work
              </Link>
              . Patient education and comparisons live in the{" "}
              <Link href="/hair-transplant-problems" className="text-amber-400 hover:text-amber-300">
                patient guides hub
              </Link>
              —this page stays focused on review framework and trust.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
