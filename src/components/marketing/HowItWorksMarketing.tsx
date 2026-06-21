"use client";

import Link from "next/link";
import StartFreeAuditButton from "@/components/audit/StartFreeAuditButton";
import TrackedLink from "@/components/analytics/TrackedLink";
import PublicMarketingCtaPanel from "@/components/marketing/PublicMarketingCtaPanel";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import { useI18n } from "@/components/i18n/I18nProvider";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import {
  PUBLIC_AUDIT_FLOW_STEPS,
  PUBLIC_CTAS,
  PUBLIC_INDEPENDENCE_MESSAGE,
} from "@/lib/marketing/publicMarketingCopy";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { Badge, Section, networkButtonVariants } from "@/packages/ui";

function stepEyebrow(t: (k: TranslationKey) => string, n: number) {
  return t("marketing.shared.stepEyebrow").replace(/\{\{n\}\}/g, String(n));
}

export default function HowItWorksMarketing() {
  const { t } = useI18n();

  const i18nFlowSteps = [
    "marketing.howItWorks.flowStep1",
    "marketing.howItWorks.flowStep2",
    "marketing.howItWorks.flowStep3",
    "marketing.howItWorks.flowStep4",
    "marketing.howItWorks.flowStep5",
  ] as const satisfies readonly TranslationKey[];

  const flowSteps = i18nFlowSteps.map((key, index) => ({
    title: PUBLIC_AUDIT_FLOW_STEPS[index]?.title ?? `Step ${index + 1}`,
    body: t(key),
  }));

  return (
    <main id="main-content" className="relative flex-1">
      <PublicMarketingHero
        badge="Patient pathway"
        title={t("marketing.howItWorks.heroTitle")}
        description={t("marketing.howItWorks.heroSubtitle")}
        centered
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <StartFreeAuditButton
            eventName="cta_start_free_audit_how_it_works_hero"
            className={fiHairauditPrimaryButtonClass("lg")}
          >
            {PUBLIC_CTAS.startFreeHairAudit}
          </StartFreeAuditButton>
          <TrackedLink
            href="/demo-report"
            eventName="cta_view_sample_report_how_it_works_hero"
            className={cn(networkButtonVariants({ variant: "secondary", size: "lg" }))}
          >
            {PUBLIC_CTAS.viewSampleReport}
          </TrackedLink>
        </div>
        <p className="mt-4 text-center text-sm font-medium text-amber-300/90">
          {PUBLIC_INDEPENDENCE_MESSAGE}
        </p>
        <div className="mx-auto mt-6 max-w-2xl text-left">
          <ReviewProcessReassurance />
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted-foreground">
          {t("marketing.howItWorks.afterSubmitNote")}
        </p>
      </PublicMarketingHero>

      <Section className="border-t border-border/30">
        <div className="space-y-8">
          <div className="max-w-3xl space-y-3">
            <Badge tone="neutral">{t("marketing.howItWorks.stepsTitle")}</Badge>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Your HairAudit journey
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {flowSteps.map((step, i) => (
              <article
                key={step.title}
                className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-fi-panel"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stepEyebrow(t, i + 1)}
                </p>
                <h3 className="mt-2 text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section className="border-t border-border/30">
        <div className="mx-auto max-w-3xl space-y-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("marketing.howItWorks.afterTitle")}
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            {t("marketing.howItWorks.afterBody")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("marketing.howItWorks.standardsPrompt")}{" "}
            <Link
              href="/professionals"
              className="font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              {t("marketing.howItWorks.forProfessionalsLink")}
            </Link>
            .
          </p>
        </div>
      </Section>

      <PublicMarketingCtaPanel
        title={t("marketing.howItWorks.closingTitle")}
        description={t("marketing.howItWorks.closingSubtitle")}
        actions={[
          {
            href: "/request-review",
            label: PUBLIC_CTAS.startFreeHairAudit,
            variant: "primary",
            eventName: "cta_start_free_audit_how_it_works_footer",
            useStartFreeAuditButton: true,
          },
          {
            href: "/demo-report",
            label: PUBLIC_CTAS.viewSampleReport,
            variant: "secondary",
            eventName: "cta_view_sample_report_how_it_works_footer",
          },
        ]}
      >
        <div className="mx-auto mt-6 max-w-2xl text-left">
          <ReviewProcessReassurance />
        </div>
      </PublicMarketingCtaPanel>
    </main>
  );
}
