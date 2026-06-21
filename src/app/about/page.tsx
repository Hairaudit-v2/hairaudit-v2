import Link from "next/link";

import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicMarketingCtaPanel from "@/components/marketing/PublicMarketingCtaPanel";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import TrackedLink from "@/components/analytics/TrackedLink";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { FI_HOME } from "@/config/platform-links";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { PUBLIC_CTAS, PUBLIC_ECOSYSTEM_FOOTER } from "@/lib/marketing/publicMarketingCopy";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { Badge, FeatureGrid, Section, networkButtonVariants } from "@/packages/ui";
import { cn } from "@/lib/utils";

export const metadata = createPageMetadata({
  title: "About HairAudit | Independent Patient Protection | HairAudit",
  description:
    "HairAudit is independent patient protection infrastructure—an intelligence layer for patients, clinics, and professionals built for transparency, donor safety, and long-term planning.",
  pathname: "/about",
});

const pillars = [
  {
    title: "Independent analysis for patients",
    body: "Patients receive evidence-led Clinical Intelligence Reports that explain what photos support, where confidence is limited, and what may be worth discussing with a clinician—without clinic marketing.",
  },
  {
    title: "Quality assurance for clinics",
    body: "Clinics use structured internal audits, transparency participation, and certification-ready benchmarking to improve documentation, donor stewardship, and accountability over time.",
  },
  {
    title: "Standards for professionals",
    body: "Surgeons and professional teams can build verified profiles, contribute documented cases, and align with consistent review standards across the Follicle Intelligence Network.",
  },
] as const;

export default function AboutPage() {
  return (
    <HairAuditFiMarketingShell>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "About HairAudit", pathname: "/about" },
        ]}
      />

      <main id="main-content" className="relative flex-1">
        <PublicMarketingHero
          badge="Independent Patient Protection"
          title="Independent patient protection infrastructure"
          description={
            <>
              HairAudit is an independent intelligence layer for hair restoration medicine—built to improve
              transparency, accountability, and long-term outcomes for patients, clinics, and professionals.
            </>
          }
        >
          <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
            <TrackedLink
              href="/request-review"
              eventName="cta_start_free_hairaudit_about"
              className={fiHairauditPrimaryButtonClass("lg")}
            >
              {PUBLIC_CTAS.startFreeHairAudit}
            </TrackedLink>
            <TrackedLink
              href="/professionals/apply"
              eventName="cta_create_professional_profile_about"
              className={cn(networkButtonVariants({ variant: "secondary", size: "lg" }))}
            >
              {PUBLIC_CTAS.createProfessionalProfile}
            </TrackedLink>
          </div>
        </PublicMarketingHero>

        <Section className="border-t border-border/30">
          <div className="space-y-8">
            <div className="max-w-3xl space-y-3">
              <Badge tone="neutral">What HairAudit is</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                An intelligence layer—not a clinic, not a referral funnel
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                HairAudit structures patient evidence for independent analysis, supports clinical verification where
                needed, and delivers confidence-aware reporting. We do not perform surgery or promote clinics.
              </p>
            </div>
            <FeatureGrid columnsClassName="md:grid-cols-3">
              {pillars.map(({ title, body }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel"
                >
                  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </article>
              ))}
            </FeatureGrid>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-3xl space-y-6">
            <Badge tone="neutral">Ecosystem positioning</Badge>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Standalone review platform within the Follicle Intelligence Network
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              HairAudit remains a standalone patient protection platform while sharing engineering standards with the
              wider Follicle Intelligence ecosystem. Methodology, transparency infrastructure, and long-term planning
              tools are designed to work together without compromising independence.
            </p>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <a href={FI_HOME} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                {PUBLIC_ECOSYSTEM_FOOTER}
              </a>
            </p>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <article className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
              <h2 className="text-xl font-semibold text-foreground">What we do</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We deliver independent, evidence-led analysis across donor safety, recipient planning, procedural
                concerns, and documentation quality—structured for patient protection and professional accountability.
              </p>
            </article>
            <article className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
              <h2 className="text-xl font-semibold text-foreground">What we do not do</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                HairAudit does not sell surgery, paid clinic placements, or promotional directory listings. Reports
                support informed conversations—they do not replace in-person medical diagnosis.
              </p>
            </article>
          </div>
        </Section>

        <PublicMarketingCtaPanel
          title="Start with the pathway that fits you"
          description={
            <>
              Patients can begin a free HairAudit today. Clinics and professionals can create a profile and build
              transparency records over time. Explore{" "}
              <Link href="/methodology" className="font-medium text-amber-400 hover:text-amber-300">
                methodology
              </Link>{" "}
              or{" "}
              <Link href="/services" className="font-medium text-amber-400 hover:text-amber-300">
                HairAudit pathways
              </Link>
              .
            </>
          }
        />
      </main>
    </HairAuditFiMarketingShell>
  );
}
