"use client";

import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";
import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicTrustArchitectureBlock from "@/components/marketing/PublicTrustArchitectureBlock";
import DemoReportCtaLinks from "./DemoReportCtaLinks";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import { cn } from "@/lib/utils";
import { Badge, Section, networkButtonVariants } from "@/packages/ui";

export default function DemoReportPageContent() {
  return (
    <HairAuditFiMarketingShell>
      <main id="main-content" className="relative flex-1">
        <Section className="pt-10 sm:pt-14">
          <div className="mx-auto max-w-4xl space-y-6">
            <Badge tone="accent">Clinical Intelligence Report</Badge>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Clinical Intelligence Report Preview
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              See how HairAudit evaluates donor quality, progression risk, recipient viability, and planning concerns.
            </p>
            <PublicTrustArchitectureBlock surface="fi" />
            <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
              <TrackedLink
                href={PATHWAY_CHOOSER_HREF}
                eventName="cta_start_free_audit_demo_hero"
                className={fiHairauditPrimaryButtonClass("lg")}
                data-testid="choose-review-pathway-demo-hero"
              >
                {PUBLIC_CTAS.chooseYourReview}
              </TrackedLink>
              <DemoReportCtaLinks />
            </div>
          </div>
        </Section>

        <Section className="border-t border-border/30 pb-6">
          <div className="mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur">
              <div className="flex flex-col gap-2 border-b border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Report preview
                </span>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="/api/print/demo-report"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-sky-300 hover:text-sky-200"
                  >
                    Open in new tab
                  </a>
                  <a
                    href="/api/reports/demo-pdf"
                    className="text-xs font-medium text-sky-300 hover:text-sky-200"
                  >
                    Download PDF
                  </a>
                </div>
              </div>
              <iframe
                title="HairAudit Clinical Intelligence Report preview"
                src="/api/print/demo-report"
                className="h-[720px] w-full border-0 bg-white sm:h-[840px]"
              />
            </div>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-r from-amber-400/10 via-card/80 to-sky-400/10 p-8 text-center shadow-fi-panel sm:text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Next step</p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Ready for your own Clinical Intelligence Report?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mx-0">
              Start with secure upload. Add the photos you have now; your report will explain where evidence is strong
              and where confidence is limited.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
              <TrackedLink
                href={PATHWAY_CHOOSER_HREF}
                eventName="cta_start_free_audit_demo_page"
                className={fiHairauditPrimaryButtonClass("md")}
                data-testid="choose-review-pathway-demo-footer"
              >
                {PUBLIC_CTAS.chooseYourReview}
              </TrackedLink>
              <Link
                href="/how-it-works"
                className={cn(networkButtonVariants({ variant: "ghost", size: "md" }))}
              >
                How It Works
              </Link>
            </div>
          </div>
        </Section>
      </main>
    </HairAuditFiMarketingShell>
  );
}
