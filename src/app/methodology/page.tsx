import Link from "next/link";

import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicMarketingCtaPanel from "@/components/marketing/PublicMarketingCtaPanel";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { GeoContextLine } from "@/components/patient-education/GeoContentBlocks";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { Badge, FeatureGrid, Section } from "@/packages/ui";

export const metadata = createPageMetadata({
  title: "HairAudit Methodology | Evidence-Led Independent Analysis | HairAudit",
  description:
    "How HairAudit conducts evidence-led independent analysis: donor quality, hair loss classification, recipient planning, progression risk, procedural concerns, and confidence-aware Clinical Intelligence Reports.",
  pathname: "/methodology",
});

const reviewDomains = [
  {
    title: "Donor quality & safety",
    body: "Extraction pattern, spacing, sustainability, and signs of overharvest risk visible in submitted photos.",
  },
  {
    title: "Hair loss classification",
    body: "Pattern and progression context that affects long-term planning and conservative recipient design.",
  },
  {
    title: "Recipient planning",
    body: "Hairline framing, density distribution, and design choices that affect naturalness and future options.",
  },
  {
    title: "Progression risk",
    body: "Timeline fit, growth expectations, and when apparent concerns may reflect normal healing vs evidence of problems.",
  },
  {
    title: "Procedural concerns",
    body: "Implantation cues, direction, and technique-related observations supported by visual evidence.",
  },
  {
    title: "Confidence-aware reporting",
    body: "Explicit documentation of evidence strength, missing inputs, and limits of photo-only review.",
  },
] as const;

export default function MethodologyPage() {
  return (
    <HairAuditFiMarketingShell>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Methodology", pathname: "/methodology" },
        ]}
      />

      <main id="main-content" className="relative flex-1">
        <PublicMarketingHero
          badge="Evidence-Led Methodology"
          title="Evidence-led methodology for independent analysis"
          description={
            <>
              HairAudit applies consistent review standards across donor safety, recipient planning, procedural
              concerns, and documentation quality. Clinical Intelligence Reports explain what the evidence supports,
              where confidence is limited, and practical next steps—without selling surgery or replacing in-person
              medical diagnosis.
            </>
          }
        />

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-3xl">
            <GeoContextLine label="How this differs from a typical clinic opinion">
              <p>
                A clinic that performed the procedure can offer useful operative context, but it also has a different
                position when interpreting the same result. HairAudit does not sell surgery or promote clinics. For a
                patient-facing comparison, read{" "}
                <Link
                  href="/hair-transplant-second-opinion-vs-clinic-opinion"
                  className="font-medium text-amber-400 hover:text-amber-300"
                >
                  independent analysis vs clinic opinion
                </Link>
                .
              </p>
            </GeoContextLine>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="space-y-8">
            <div className="max-w-3xl space-y-3">
              <Badge tone="neutral">Review domains</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                What independent analysis examines
              </h2>
            </div>
            <FeatureGrid columnsClassName="md:grid-cols-2 lg:grid-cols-3">
              {reviewDomains.map(({ title, body }) => (
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
          <div className="mx-auto max-w-3xl space-y-4">
            <Badge tone="neutral">Limits & honesty</Badge>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Confidence in your Clinical Intelligence Report
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Some cases have strong photo evidence. Others have missing images or incomplete timelines. HairAudit states
              those limits directly so you know how confident each conclusion is.
            </p>
            <GeoContextLine label="What photos and remote review cannot replace">
              <p>
                No photo set proves every microscopic detail of graft handling or exact survival rates. Scope and
                boundaries are summarized in{" "}
                <Link
                  href="/what-an-independent-hair-transplant-audit-can-and-cannot-do"
                  className="font-medium text-amber-400 hover:text-amber-300"
                >
                  what independent analysis can and cannot do
                </Link>{" "}
                and{" "}
                <Link
                  href="/can-a-hair-transplant-be-audited-from-photos"
                  className="font-medium text-amber-400 hover:text-amber-300"
                >
                  reviewing from photos
                </Link>
                .
              </p>
            </GeoContextLine>
            <p className="text-sm text-muted-foreground">
              For technical standards and professional participation frameworks, see{" "}
              <Link href="/professionals" className="font-medium text-amber-400 hover:text-amber-300">
                professional standards
              </Link>
              .
            </p>
          </div>
        </Section>

        <PublicMarketingCtaPanel
          title="See the methodology in a real report preview"
          description="Start your free HairAudit when ready, or preview a sample Clinical Intelligence Report first."
          actions={[
            {
              href: "/request-review#choose-pathway",
              label: PUBLIC_CTAS.startReview,
              variant: "primary",
              eventName: "cta_choose_review_pathway_methodology",
            },
            {
              href: "/demo-report",
              label: PUBLIC_CTAS.viewSampleReport,
              variant: "secondary",
              eventName: "cta_view_sample_report_methodology",
            },
            {
              href: "/faq",
              label: "HairAudit FAQ",
              variant: "secondary",
              eventName: "cta_faq_methodology",
            },
          ]}
        />
      </main>
    </HairAuditFiMarketingShell>
  );
}
