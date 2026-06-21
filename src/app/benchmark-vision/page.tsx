import Link from "next/link";

import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicMarketingCtaPanel from "@/components/marketing/PublicMarketingCtaPanel";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { Badge, FeatureGrid, Section, networkButtonVariants } from "@/packages/ui";
import { cn } from "@/lib/utils";

export const metadata = createPageMetadata({
  title: "Benchmark Vision | HairAudit",
  description:
    "HairAudit benchmark vision: building independent infrastructure that may support structured transplant outcome benchmarking over time.",
  pathname: "/benchmark-vision",
});

const enablementCards = [
  {
    title: "Outcome pattern analysis",
    desc: "Structured case reviews may allow patterns in transplant outcomes to be better understood across approaches, techniques, and documentation quality.",
  },
  {
    title: "Transparency signals",
    desc: "Participation in structured documentation and review may allow clinics and surgeons to demonstrate transparency and consistency.",
  },
  {
    title: "Patient education",
    desc: "A benchmark-informed dataset may help patients understand what well-documented outcomes look like and how evidence quality affects interpretation.",
  },
  {
    title: "Field improvement",
    desc: "Independent benchmarking may help the field move toward more transparent reporting and evidence-informed improvement.",
  },
] as const;

export default function BenchmarkVisionPage() {
  return (
    <HairAuditFiMarketingShell>
      <main id="main-content" className="relative flex-1">
        <PublicMarketingHero
          badge="Benchmark vision"
          title="Building independent hair transplant benchmarking infrastructure"
          description={
            <>
              Hair transplantation has grown rapidly, yet the field still lacks independent outcome benchmarking.
              HairAudit is designed to support a structured dataset that may allow outcomes, documentation quality, and
              surgical transparency to be evaluated across cases over time.
            </>
          }
          centered
        >
          <div className="flex flex-col flex-wrap justify-center gap-3 sm:flex-row">
            <Link href="/how-it-works" className={cn(networkButtonVariants({ variant: "secondary", size: "lg" }))}>
              How It Works
            </Link>
            <Link href="/clinics" className={cn(networkButtonVariants({ variant: "secondary", size: "lg" }))}>
              Explore participating clinics
            </Link>
          </div>
        </PublicMarketingHero>

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-3xl space-y-4">
            <Badge tone="neutral">Why it matters</Badge>
            <p className="text-base leading-relaxed text-muted-foreground">
              Independent benchmarking supports patient protection, donor safety, and long-term planning—not promotional
              clinic rankings. HairAudit does not sell surgery or paid placements.
            </p>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="space-y-8">
            <div className="max-w-3xl space-y-3">
              <Badge tone="neutral">What benchmarking may enable</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Evidence-led infrastructure over time
              </h2>
            </div>
            <FeatureGrid columnsClassName="md:grid-cols-2">
              {enablementCards.map(({ title, desc }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel"
                >
                  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </article>
              ))}
            </FeatureGrid>
          </div>
        </Section>

        <PublicMarketingCtaPanel
          title="Explore HairAudit today"
          description="Patients can begin independent analysis now. Clinics and professionals can build transparency records through documented participation."
          actions={[
            {
              href: "/request-review#choose-pathway",
              label: PUBLIC_CTAS.startReview,
              variant: "primary",
              eventName: "cta_choose_review_pathway_benchmark_vision",
            },
            {
              href: "/for-clinics",
              label: PUBLIC_CTAS.createClinicProfile,
              variant: "secondary",
              eventName: "cta_create_clinic_benchmark_vision",
            },
          ]}
        />
      </main>
    </HairAuditFiMarketingShell>
  );
}
