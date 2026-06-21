import Link from "next/link";
import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import ProfessionalPathwayRibbon from "@/components/marketing/ProfessionalPathwayRibbon";
import PublicMarketingCtaPanel from "@/components/marketing/PublicMarketingCtaPanel";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import TrackedLink from "@/components/analytics/TrackedLink";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { StepIcons } from "@/components/ui/StepIcons";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { Badge, Section } from "@/packages/ui";
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
    <HairAuditFiMarketingShell>
      <main id="main-content" className="relative flex-1">
        <Section className="pt-6 pb-0">
          <div className="mx-auto max-w-4xl">
            <ProfessionalPathwayRibbon variant="fi" />
          </div>
        </Section>

        <PublicMarketingHero
          badge="Clinic quality assurance"
          title="Clinic accountability and quality assurance infrastructure"
          description="HairAudit gives clinics structured internal audits, transparency participation, and certification-ready benchmarking—without turning quality assurance into a basic directory listing."
          centered
        >
          <div className="flex justify-center">
            <TrackedLink
              href="/signup?role=clinic"
              eventName="cta_create_clinic_profile_for_clinics"
              className={fiHairauditPrimaryButtonClass("lg")}
            >
              {PUBLIC_CTAS.createClinicProfile}
            </TrackedLink>
          </div>
        </PublicMarketingHero>

        <Section className="border-t border-border/30">
          <div className="max-w-4xl space-y-8">
            <div className="space-y-3">
              <Badge tone="neutral">Why participate</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Why clinics participate
              </h2>
              <p className="max-w-2xl text-muted-foreground">
                HairAudit gives you a structured way to improve, prove, and display commitment to quality—without
                changing how you submit or manage cases.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {WHY_PARTICIPATE_ITEMS.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-fi-panel sm:p-6">
                  <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section className="border-t border-border/30 bg-card/30">
          <div className="max-w-4xl space-y-8">
            <Badge tone="neutral">How it works</Badge>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="flex flex-col items-center rounded-2xl border border-border/50 bg-card/70 p-6 text-center shadow-fi-panel"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
                    {step.icon}
                  </span>
                  <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-amber-300/90">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="max-w-4xl space-y-8">
            <div className="space-y-3">
              <Badge tone="neutral">Certification</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Verified clinic intelligence
              </h2>
              <p className="max-w-2xl text-muted-foreground">
                Recognition is based on independently reviewed surgical data and verified case submissions—not
                purchased placements.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {CERTIFICATION_TIERS.map(({ tier, blurb }) => (
                <div
                  key={tier}
                  className="min-w-[200px] max-w-[240px] rounded-2xl border border-border/50 bg-card/70 p-5 shadow-fi-panel"
                >
                  <CertificationBadge tier={tier} variant="full" />
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{blurb}</p>
                </div>
              ))}
            </div>
            <div>
              <Link href="/certification-explained" className="text-sm font-medium text-sky-300 hover:text-sky-200">
                Learn more about certification →
              </Link>
            </div>
          </div>
        </Section>

        <Section className="border-t border-border/30 bg-card/30">
          <div className="mx-auto max-w-3xl space-y-4">
            <Badge tone="neutral">Clinic transparency</Badge>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Public proof and visibility
            </h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              When you choose to make cases publicly visible, they strengthen your clinic profile and help patients
              evaluate transparency and commitment to quality. Public cases are verified by HairAudit and displayed with
              clear context—no cherry-picking, no opaque claims.
            </p>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="max-w-4xl space-y-12">
            <div className="space-y-3">
              <Badge tone="neutral">Trust assets</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Trust assets you can display
              </h2>
              <p className="max-w-2xl text-muted-foreground">
                Certification comes with displayable assets: a certification badge, certificate-style recognition, and a
                website badge you can embed on your site.
              </p>
            </div>
            <div className="space-y-16">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-300">Certification badge</h3>
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
                  <CertificationBadge tier="GOLD" variant="full" />
                  <CertificationBadge tier="PLATINUM" variant="compact" />
                  <p className="mt-2 w-full text-sm text-muted-foreground">Shown on your profile and in clinic discovery.</p>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-300">
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
        </Section>

        <PublicMarketingCtaPanel
          title="Create your clinic profile"
          description="Begin with internal audits, build certification recognition, and demonstrate accountability over time."
          actions={[
            {
              href: "/signup?role=clinic",
              label: PUBLIC_CTAS.createClinicProfile,
              variant: "primary",
              eventName: "cta_join_clinics_final",
              useStartFreeAuditButton: false,
            },
          ]}
        />
      </main>
    </HairAuditFiMarketingShell>
  );
}
