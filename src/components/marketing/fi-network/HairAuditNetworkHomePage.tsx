"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Camera,
  Compass,
  HeartPulse,
  Smile,
} from "lucide-react";

import TrackedLink from "@/components/analytics/TrackedLink";
import { HA_FI_HOME } from "@/content/hairauditFiNetworkHome";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { cn } from "@/lib/utils";
import { resolveProductHref } from "@/lib/network/resolveProductHref";
import {
  Badge,
  FeatureGrid,
  MetricCard,
  NETWORK_PRODUCTS,
  NetworkAudienceSection,
  NetworkCTASection,
  NetworkEcosystemMapSection,
  NetworkHero,
  NetworkIntelligenceLayerSection,
  NetworkProblemSolutionSection,
  ProductPill,
  Section,
  networkButtonVariants,
} from "@/packages/ui";

const CertifiedClinicsSection = dynamic(
  () => import("@/components/home/CertifiedClinicsSection").then((m) => m.default),
  { ssr: true }
);

const INTELLIGENCE_ICONS = [Camera, Activity, HeartPulse, Compass, Smile, BarChart3] as const;

export default function HairAuditNetworkHomePage() {
  const intelligenceLayers = HA_FI_HOME.intelligence.layers.map((layer, idx) => {
    const Icon = INTELLIGENCE_ICONS[idx] ?? BarChart3;
    return {
      title: layer.title,
      description: layer.description,
      icon: <Icon className="h-9 w-9 text-sky-200/90" aria-hidden />,
    };
  });

  return (
    <main id="main-content" className="relative flex-1">
      <NetworkHero
        platform="hairaudit"
        eyebrow={HA_FI_HOME.hero.eyebrow}
        title={HA_FI_HOME.hero.title}
        subtitle={HA_FI_HOME.hero.subtitle}
        networkLabel="HairAudit · Follicle Intelligence Network"
        actions={
          <>
            <TrackedLink
              href="/for-clinics"
              eventName="cta_request_clinic_access_hero"
              className={fiHairauditPrimaryButtonClass("lg")}
            >
              {HA_FI_HOME.hero.ctaClinic}
            </TrackedLink>
            <Link
              href="/follicle-intelligence"
              className={cn(networkButtonVariants({ variant: "secondary", size: "lg" }))}
              prefetch
            >
              {HA_FI_HOME.hero.ctaNetwork}
            </Link>
          </>
        }
        aside={
          <div className="flex flex-col gap-4 lg:items-end">
            <p className="max-w-sm text-right text-xs leading-relaxed text-muted-foreground">
              HairAudit helps clinics, surgeons and patients measure surgical quality, verify outcomes and build trust
              through structured evidence.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              {NETWORK_PRODUCTS.map((p) => (
                <ProductPill
                  key={p.slug}
                  slug={p.slug}
                  name={p.name}
                  category={p.category}
                  href={resolveProductHref(p.slug)}
                  active={p.slug === "hairaudit"}
                />
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge tone="accent">Verification infrastructure</Badge>
              <Badge tone="neutral">Surgical QA</Badge>
            </div>
          </div>
        }
      />

      <NetworkProblemSolutionSection
        eyebrow={HA_FI_HOME.trust.eyebrow}
        title={HA_FI_HOME.trust.title}
        description={HA_FI_HOME.trust.description}
        problems={{
          title: HA_FI_HOME.trust.problem.title,
          body: HA_FI_HOME.trust.problem.body,
        }}
        solutions={{
          title: HA_FI_HOME.trust.solution.title,
          body: HA_FI_HOME.trust.solution.body,
        }}
      />

      <NetworkIntelligenceLayerSection
        eyebrow={HA_FI_HOME.intelligence.eyebrow}
        title={HA_FI_HOME.intelligence.title}
        description={HA_FI_HOME.intelligence.description}
        layers={intelligenceLayers}
      />

      <NetworkAudienceSection
        eyebrow={HA_FI_HOME.audience.eyebrow}
        title={HA_FI_HOME.audience.title}
        description={HA_FI_HOME.audience.description}
        segments={HA_FI_HOME.audience.segments}
      />

      <CertifiedClinicsSection />

      <NetworkEcosystemMapSection
        eyebrow={HA_FI_HOME.ecosystem.eyebrow}
        title={HA_FI_HOME.ecosystem.title}
        description={HA_FI_HOME.ecosystem.description}
        resolveProductHref={resolveProductHref}
        footer={
          <div className="mt-10 max-w-3xl space-y-3">
            <Badge tone="accent">Global Intelligence Network</Badge>
            <p className="text-sm leading-relaxed text-muted-foreground">
              HairAudit connects into the network&apos;s shared intelligence layer so structured signals can compound
              across clinics, regions and time — without turning patient care into promotional leaderboards.
            </p>
          </div>
        }
      />

      <Section className="border-t border-border/30">
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{HA_FI_HOME.metrics.eyebrow}</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {HA_FI_HOME.metrics.title}
            </h2>
          </div>
          <FeatureGrid columnsClassName="md:grid-cols-3">
            {HA_FI_HOME.metrics.items.map((m) => (
              <MetricCard key={m.label} label={m.label} value={m.value} hint={m.hint} />
            ))}
          </FeatureGrid>
        </div>
      </Section>

      <NetworkCTASection
        id="request-hairaudit-access"
        align="center"
        eyebrow={HA_FI_HOME.finalCta.eyebrow}
        title={HA_FI_HOME.finalCta.title}
        description={HA_FI_HOME.finalCta.description}
        actions={
          <TrackedLink
            href="/signup"
            eventName="cta_request_hairaudit_access_footer"
            className={fiHairauditPrimaryButtonClass("lg")}
          >
            {HA_FI_HOME.finalCta.button}
          </TrackedLink>
        }
      />
    </main>
  );
}
