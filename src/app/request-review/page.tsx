import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import TrackedLink from "@/components/analytics/TrackedLink";
import StartFreeAuditButton from "@/components/audit/StartFreeAuditButton";
import PatientPathwayChooser from "@/components/marketing/PatientPathwayChooser";
import { GeoContextLine } from "@/components/patient-education/GeoContentBlocks";
import PatientPhotoChecklist from "@/components/marketing/PatientPhotoChecklist";
import PatientTrustPointsBlock from "@/components/marketing/PatientTrustPointsBlock";

export const metadata = createPageMetadata({
  title: "Start a Free Hair Transplant Audit | Secure Upload | HairAudit",
  description:
    "Start a free independent hair transplant audit with secure photo upload, structured review of donor area, growth, density, design, and technique, and a clear HairAudit report.",
  pathname: "/request-review",
});

const requestFaqs = [
  {
    question: "How long does submission take?",
    answer: "Most people finish in about 6 to 8 minutes if photos are ready. You can add missing details later.",
  },
  {
    question: "What do I need before I start?",
    answer:
      "Useful photos include the front hairline, left and right sides, top or crown, donor area, and early post-op photos if you have them. Graft counts or clinic papers also help when available.",
  },
  {
    question: "Is HairAudit independent from clinics?",
    answer: "Yes. HairAudit is independent and does not sell surgery, clinic referrals, or promotional placements.",
  },
];

export default function RequestReviewPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Start a free HairAudit", pathname: "/request-review" },
        ]}
      />
      <MedicalProcedureFaqSchema
        pageName="Start a Free HairAudit"
        pageDescription="Submit your case for independent hair transplant evidence review and reporting."
        faqs={requestFaqs}
      />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(56,189,248,0.06),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1 px-4 sm:px-6 py-14 sm:py-20 pb-28 lg:pb-20">
        <div className="max-w-4xl mx-auto space-y-10 sm:space-y-12">
          <header className="space-y-4">
            <p className="inline-flex rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">
              Free patient review — choose your pathway
            </p>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Start your independent HairAudit review
              </h1>
              <p className="mt-3 text-lg text-slate-200 max-w-2xl leading-relaxed">
                Choose pre-surgery planning review or post-surgery result review. Each pathway uses tailored
                uploads, questions, and report sections for your stage.
              </p>
            </div>
            <p className="text-sm font-medium text-emerald-200/95">
              Takes around 6–8 minutes. You can add missing details later.
            </p>
            <p className="text-xs text-amber-200/90 font-medium">
              Independent review · Secure upload · Private photo handling
            </p>
          </header>

          <PatientPathwayChooser className="mt-2" />

          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-6 sm:p-7">
            <p className="text-sm text-amber-50/95 leading-relaxed max-w-2xl">
              Your report explains what the evidence supports, where confidence is limited, and what may be worth
              discussing with your clinician. HairAudit does not sell surgery, clinic referrals, or remote diagnoses.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
              <StartFreeAuditButton
                eventName="cta_start_free_audit_request_review_primary"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-400 text-slate-950 font-semibold hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-70 disabled:cursor-wait"
              >
                Start Free Audit
              </StartFreeAuditButton>
              <TrackedLink
                href="/demo-report"
                eventName="cta_view_sample_report_request_review_primary"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-500/80 text-slate-100 font-medium hover:border-slate-400 hover:bg-white/5 transition-colors"
              >
                View Sample Report
              </TrackedLink>
            </div>
          </div>

          <PatientTrustPointsBlock />

          <PatientPhotoChecklist />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-base font-semibold text-white">What happens next</h2>
            <ol className="mt-4 space-y-2.5 text-sm text-slate-300 leading-relaxed">
              <li>1. Start the secure upload straight away — no account needed.</li>
              <li>2. Add a few key surgery details.</li>
              <li>3. Tell us where to send your report, and we create your account automatically.</li>
              <li>4. HairAudit reviews the evidence and you receive clear, confidence-aware guidance.</li>
            </ol>
          </div>

          <ReviewProcessReassurance />

          <GeoContextLine label="What this page is for">
            <p>
              This is the patient audit path: create your account, add photos, and submit the evidence you have. Longer
              education and photo guidance live in the{" "}
              <Link href="/hair-transplant-problems" className="text-amber-400 hover:text-amber-300 font-medium">
                patient guides hub
              </Link>
              ; framework and limits are on{" "}
              <Link href="/methodology" className="text-amber-400 hover:text-amber-300 font-medium">
                methodology
              </Link>
              .
            </p>
          </GeoContextLine>

          <p className="text-sm text-slate-400 leading-relaxed">
            Many patients only realise something may be wrong months after surgery. HairAudit helps you understand
            whether your result is within an expected range, evidence-limited, or worth further review.
          </p>
          <p className="text-sm text-slate-400">
            Looking for a validation-first pathway?{" "}
            <Link href="/rate-my-hair-transplant" className="text-emerald-300 hover:text-emerald-200 transition-colors">
              How Good Is My Hair Transplant?
            </Link>
          </p>

          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-950/40 p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-cyan-100 font-semibold">Clinics and doctors</p>
              <p className="mt-2 text-sm text-slate-200 leading-relaxed">
                Professional profiles, internal audits, and verified participation use a separate pathway so patient
                submission stays simple.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <Link
                href="/for-clinics"
                className="inline-flex items-center justify-center rounded-xl border border-cyan-200/35 px-4 py-2.5 text-sm font-medium text-cyan-50 hover:bg-white/5 transition-colors"
              >
                For Clinics
              </Link>
              <Link
                href="/professionals"
                className="inline-flex items-center justify-center rounded-xl border border-cyan-200/35 px-4 py-2.5 text-sm font-medium text-cyan-50 hover:bg-white/5 transition-colors"
              >
                For Professionals
              </Link>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Need an account?{" "}
              <Link href="/signup?role=clinic" className="text-cyan-200 hover:text-cyan-100 font-medium">
                Clinic signup
              </Link>
              {" · "}
              <Link href="/signup?role=doctor" className="text-cyan-200 hover:text-cyan-100 font-medium">
                Doctor signup
              </Link>
            </p>
          </div>

          <nav className="text-sm text-slate-500 pt-2" aria-label="Related pages">
            <Link href="/methodology" className="text-amber-400 hover:text-amber-300 transition-colors">
              Methodology
            </Link>
            {" · "}
            <Link href="/faq" className="text-amber-400 hover:text-amber-300 transition-colors">
              Hair transplant audit FAQ
            </Link>
            {" · "}
            <Link href="/professionals" className="text-amber-400 hover:text-amber-300 transition-colors">
              Independent audit standards for professionals
            </Link>
          </nav>
        </div>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-4xl">
          <StartFreeAuditButton
            eventName="cta_start_free_audit_request_review_sticky_mobile"
            className="flex w-full items-center justify-center rounded-xl bg-amber-400 py-3.5 text-sm font-semibold text-slate-950 hover:bg-amber-300 transition-colors disabled:opacity-70 disabled:cursor-wait"
          >
            Start Free Audit
          </StartFreeAuditButton>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
