"use client";

import { CalendarClock, ShieldCheck } from "lucide-react";
import StartFreeAuditButton from "@/components/audit/StartFreeAuditButton";
import TrackedLink from "@/components/analytics/TrackedLink";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import {
  PATIENT_PATHWAY_DEFINITIONS,
  PATIENT_REVIEW_PATHWAYS,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import { cn } from "@/lib/utils";
import { Badge, networkButtonVariants } from "@/packages/ui";

const PATHWAY_ICONS: Record<PatientReviewPathway, typeof CalendarClock> = {
  pre_surgery: CalendarClock,
  post_surgery: ShieldCheck,
};

type PatientPathwayChooserProps = {
  layout?: "cards" | "hero";
  className?: string;
};

export default function PatientPathwayChooser({ layout = "cards", className }: PatientPathwayChooserProps) {
  const { t } = useI18n();

  if (layout === "hero") {
    return (
      <div
        data-testid="pathway-chooser"
        className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap", className)}
      >
        {PATIENT_REVIEW_PATHWAYS.map((pathway) => {
          const def = PATIENT_PATHWAY_DEFINITIONS[pathway];
          const isPrimary = pathway === "post_surgery";
          return (
            <StartFreeAuditButton
              key={pathway}
              pathway={pathway}
              eventName={`cta_start_free_audit_home_hero_${def.analyticsEventSuffix}`}
              className={
                isPrimary
                  ? fiHairauditPrimaryButtonClass("lg")
                  : cn(networkButtonVariants({ variant: "secondary", size: "lg" }), "min-w-[12rem]")
              }
            >
              {t(def.marketingCtaKey as never)}
            </StartFreeAuditButton>
          );
        })}
        <TrackedLink
          href="/demo-report"
          eventName="cta_view_sample_report_home_hero"
          className={cn(networkButtonVariants({ variant: "ghost", size: "lg" }))}
        >
          View Sample Report
        </TrackedLink>
      </div>
    );
  }

  return (
    <div data-testid="pathway-chooser" className={cn("grid gap-4 md:grid-cols-2", className)}>
      {PATIENT_REVIEW_PATHWAYS.map((pathway) => {
        const def = PATIENT_PATHWAY_DEFINITIONS[pathway];
        const Icon = PATHWAY_ICONS[pathway];
        return (
          <article
            key={pathway}
            className="flex h-full flex-col rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel"
          >
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="space-y-2">
                <Badge tone={pathway === "pre_surgery" ? "neutral" : "accent"}>
                  {pathway === "pre_surgery" ? "Pathway A" : "Pathway B"}
                </Badge>
                <h3 className="text-xl font-semibold text-foreground">{t(def.marketingTitleKey as never)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(def.marketingDescriptionKey as never)}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {def.reportFocusAreaKeys.map((key) => (
                <li key={key} className="flex gap-2">
                  <span aria-hidden className="text-amber-300/80">
                    •
                  </span>
                  <span>{t(key as never)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <StartFreeAuditButton
                pathway={pathway}
                eventName={`cta_start_pathway_${def.analyticsEventSuffix}`}
                className={cn(
                  fiHairauditPrimaryButtonClass("md"),
                  "w-full justify-center sm:w-auto"
                )}
              >
                {t(def.marketingCtaKey as never)}
              </StartFreeAuditButton>
            </div>
          </article>
        );
      })}
    </div>
  );
}
