import type { ReactNode } from "react";
import Link from "next/link";

import StartFreeAuditButton from "@/components/audit/StartFreeAuditButton";
import TrackedLink from "@/components/analytics/TrackedLink";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import { cn } from "@/lib/utils";
import { Section, networkButtonVariants } from "@/packages/ui";

export type PublicMarketingCtaAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
  eventName?: string;
  /**
   * When true, routes to the pathway chooser (never starts an audit inline).
   * @deprecated Prefer a plain `href: PATHWAY_CHOOSER_HREF` action — kept for existing panels.
   */
  useStartFreeAuditButton?: boolean;
  /** Ignored — public panels must route to the pathway chooser first. */
  pathway?: PatientReviewPathway;
};

type PublicMarketingCtaPanelProps = {
  title: string;
  description: ReactNode;
  actions?: PublicMarketingCtaAction[];
  children?: ReactNode;
};

const defaultActions: PublicMarketingCtaAction[] = [
  {
    href: PATHWAY_CHOOSER_HREF,
    label: PUBLIC_CTAS.startReview,
    variant: "primary",
    eventName: "cta_choose_review_pathway_marketing_panel",
  },
  {
    href: "/demo-report",
    label: PUBLIC_CTAS.viewSampleReport,
    variant: "secondary",
    eventName: "cta_view_sample_report_marketing_panel",
  },
];

export default function PublicMarketingCtaPanel({
  title,
  description,
  actions = defaultActions,
  children,
}: PublicMarketingCtaPanelProps) {
  return (
    <Section className="border-t border-border/30 pb-16 sm:pb-20">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-r from-amber-400/10 via-card/80 to-sky-400/10 p-8 text-center shadow-fi-panel sm:p-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <div className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </div>
        <div className="mt-8 flex flex-col flex-wrap items-center justify-center gap-3 sm:flex-row">
          {actions.map((action) => {
            const className =
              action.variant === "primary"
                ? fiHairauditPrimaryButtonClass("lg")
                : cn(networkButtonVariants({ variant: "secondary", size: "lg" }));

            if (action.useStartFreeAuditButton) {
              return (
                <StartFreeAuditButton
                  key={`${action.href}-chooser`}
                  eventName={action.eventName ?? "cta_choose_review_pathway_marketing_panel"}
                  className={className}
                >
                  {action.label}
                </StartFreeAuditButton>
              );
            }

            if (action.eventName) {
              return (
                <TrackedLink
                  key={action.href}
                  href={action.href}
                  eventName={action.eventName}
                  className={className}
                >
                  {action.label}
                </TrackedLink>
              );
            }

            return (
              <Link key={action.href} href={action.href} className={className}>
                {action.label}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </Section>
  );
}
