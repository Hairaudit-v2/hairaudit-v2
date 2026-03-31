import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TrackedLink from "@/components/analytics/TrackedLink";
import { StepIcons } from "@/components/ui/StepIcons";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import {
  CertificationBadge,
  CertificatePresentation,
  WebsiteBadgePreview,
} from "@/components/clinic-profile";
import type { AwardTier } from "@/lib/transparency/awardRules";

export const revalidate = 600;

export const metadata = createPageMetadata({
  title: "For Clinics | Join HairAudit Transparency & Certification | HairAudit",
  description:
    "Clinics: internal audits, transparency participation, and certification-ready benchmarking—independent forensic standards for hair restoration quality assurance.",
  pathname: "/for-clinics",
});

const WHY_PARTICIPATE_ITEMS = [
  {
    title: "Improve outcomes privately",
    description: "Use internal audits to refine technique and documentation before any public visibility.",
  },
  {
    title: "Build public trust",
    description: "Demonstrate transparency and accountability with independently verified case data.",
  },
  {
    title: "Gain certification recognition",
    description: "Earn Active, Silver, Gold, or Platinum recognition based on validated participation and quality.",
  },
  {
    title: "Stand out in clinic discovery",
    description: "Certified clinics appear more credibly when patients compare options and evaluate quality.",
  },
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    title: "Create or claim your clinic profile",
    description: "Register your clinic and set up your profile so you can submit cases and track your progress.",
    icon: StepIcons.guidance,
  },
  {
    title: "Submit audited cases",
    description: "Submit cases for audit. Each case is evaluated against clinical standards for extraction, density, and technique.",
    icon: StepIcons.submit,
  },
  {
    title: "Choose internal or verified public audit",
    description: "Keep results private for internal improvement, or opt into verified public display to build your profile.",
    icon: StepIcons.review,
  },
  {
    title: "Build certification and public proof over time",
    description: "As you contribute more validated cases and maintain quality, your certification tier and visibility grow.",
    icon: StepIcons.report,
  },
] as const;

const CERTIFICATION_TIERS: { tier: AwardTier; blurb: string }[] = [
  {
    tier: "VERIFIED",
    blurb: "Participating clinic with verified case submissions and a commitment to transparency.",
  },
  {
    tier: "SILVER",
    blurb: "Recognised for consistent transparency and validated participation in the HairAudit ecosystem.",
  },
  {
    tier: "GOLD",
    blurb: "High recognition for documentation quality, audit consistency, and validated participation.",
  },
  {
    tier: "PLATINUM",
    blurb: "Highest recognition for sustained transparency, documentation quality, and performance across verified cases.",
  },
];

/** Placeholder props for trust-asset previews (no real clinic data). */
const TRUST_PREVIEW_CLINIC = {
  clinicName: "Your Clinic",
  clinicSlug: "your-clinic",
  currentAwardTier: "SILVER" as const,
  participationStatus: "active" as const,
  location: "City, Country",
};

export default function ForClinicsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <SiteHeader />
      <main id="main-content" className="relative flex-1">
        {/* A. Hero — no ScrollReveal so LCP (H1/CTA) paints immediately */}
        <section className="relative px-4 sm:px-6 pt-16 sm:pt-20 pb-20 sm:pb-28 lg:pt-24 lg:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]">
              Transparency, quality assurance, and verified trust
            </h1>
            <p className="mt-6 text-xl text-slate-300 max-w-xl mx-auto leading-relaxed">
              HairAudit is a global transparency and quality framework for hair restoration clinics.
            </p>
            <p className="mt-4 text-slate-400 max-w-lg mx-auto">
              Clinics can create a free profile and begin with private internal audits before making selected cases public.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <TrackedLink
                href="/signup?role=clinic"
                eventName="cta_create_clinic_profile_for_clinics"
                className="inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold text-lg hover:bg-amber-400 transition-colors border border-amber-400/50 shadow-lg shadow-amber-500/20"
              >
                Create Clinic Profile
              </TrackedLink>
              <TrackedLink
                href="/signup?role=clinic"
                eventName="cta_start_internal_audits_for_clinics"
                className="inline-flex items-center justify-center px-8 py-4 rounded-2xl border-2 border-slate-500 text-slate-200 font-medium hover:border-amber-500/50 hover:text-amber-400 transition-colors"
              >
                Start with Internal Audits
              </TrackedLink>
            </div>
          </div>
        </section>

        {/* B. Why clinics participate */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-700/60">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Why clinics participate
            </h2>
            <p className="mt-4 text-slate-400 max-w-2xl">
              HairAudit gives you a structured way to improve, prove, and display your commitment to quality — without changing how you submit or manage cases.
            </p>
            <div className="mt-12 grid sm:grid-cols-2 gap-4">
              {WHY_PARTICIPATE_ITEMS.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                  <h3 className="text-base font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* C. How it works */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 bg-slate-800/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              How it works
            </h2>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 flex flex-col items-center text-center">
                  <span className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                    {step.icon}
                  </span>
                  <p className="mt-4 text-sm font-semibold text-amber-400/90 uppercase tracking-wider">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* D. Certification */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Certification
            </h2>
            <p className="mt-4 text-slate-400 max-w-2xl">
              Recognition is based on independently audited surgical data and verified case submissions. Not purchased — earned through documented contribution and validated outcomes.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              {CERTIFICATION_TIERS.map(({ tier, blurb }) => (
                <div key={tier} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 min-w-[200px] max-w-[240px]">
                  <CertificationBadge tier={tier} variant="full" />
                  <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                    {blurb}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link
                href="/certification-explained"
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Learn more about certification →
              </Link>
            </div>
          </div>
        </section>

        {/* E. Public proof and visibility */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-700/60 bg-slate-800/30">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Public proof and visibility
            </h2>
            <p className="mt-5 text-slate-300 leading-relaxed text-lg">
              When you choose to make cases publicly visible, they strengthen your clinic profile and help patients evaluate transparency and commitment to quality. Public cases are verified by HairAudit and displayed with clear context — no cherry-picking, no opaque claims.
            </p>
          </div>
        </section>

        {/* F. Trust assets */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Trust assets you can display
            </h2>
            <p className="mt-4 text-slate-400 max-w-2xl">
              Certification comes with displayable assets: a certification badge, certificate-style recognition, and a website badge you can embed on your site.
            </p>
            <div className="mt-12 space-y-16">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3">
                  Certification badge
                </h3>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-wrap items-center gap-4">
                  <CertificationBadge tier="GOLD" variant="full" />
                  <CertificationBadge tier="PLATINUM" variant="compact" />
                  <p className="text-sm text-slate-500 w-full mt-2">
                    Shown on your profile and in clinic discovery.
                  </p>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3">
                  Certificate recognition
                </h3>
                <div className="max-w-md">
                  <CertificatePresentation
                    clinicName={TRUST_PREVIEW_CLINIC.clinicName}
                    certificationTier={TRUST_PREVIEW_CLINIC.currentAwardTier}
                    location={TRUST_PREVIEW_CLINIC.location}
                  />
                </div>
              </div>
              <div>
                <WebsiteBadgePreview
                  clinicName={TRUST_PREVIEW_CLINIC.clinicName}
                  clinicSlug={TRUST_PREVIEW_CLINIC.clinicSlug}
                  currentAwardTier={TRUST_PREVIEW_CLINIC.currentAwardTier}
                  participationStatus={TRUST_PREVIEW_CLINIC.participationStatus}
                />
              </div>
            </div>
          </div>
        </section>

        {/* G. Closing CTA */}
        <section className="relative px-4 sm:px-6 py-24 sm:py-28 border-t border-slate-700/60">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Get started free
            </h2>
            <p className="mt-5 text-xl text-slate-300">
              Create your clinic profile and start with internal audits. Build certification and public proof over time.
            </p>
            <div className="mt-10">
              <TrackedLink
                href="/signup?role=clinic"
                eventName="cta_join_clinics_final"
                className="inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold text-lg hover:bg-amber-400 transition-colors border border-amber-400/50 shadow-lg shadow-amber-500/20"
              >
                Create Clinic Profile
              </TrackedLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
