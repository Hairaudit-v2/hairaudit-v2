"use client";

import { CalendarClock, ShieldCheck } from "lucide-react";
import StartFreeAuditButton from "@/components/audit/StartFreeAuditButton";
import TrackedLink from "@/components/analytics/TrackedLink";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { DONOR_HEALING_ENTRY_CONTEXT } from "@/lib/patient/donorHealingEntry";
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
  /** HA-DONOR-HEALING-1A — server-parsed donor entry from request-review query. */
  donorEntryFromQuery?: boolean;
};

export default function PatientPathwayChooser({
  layout = "cards",
  className,
  donorEntryFromQuery = false,
}: PatientPathwayChooserProps) {
  const { t } = useI18n();
  const donorEntryActive = donorEntryFromQuery;
  const donorEntryContext = donorEntryActive ? DONOR_HEALING_ENTRY_CONTEXT : undefined;

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
              entryContext={pathway === "post_surgery" ? donorEntryContext : undefined}
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
      {donorEntryActive ? (
        <div
          className="md:col-span-2 rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground"
          data-testid="donor-entry-context-banner"
          role="status"
        >
          <p className="font-medium text-foreground">Post-Surgery Audit is recommended</p>
          <p className="mt-1">
            Because your concern relates to healing after a procedure,{" "}
            <strong className="font-semibold text-foreground">Post-Surgery Audit</strong> is the
            appropriate review pathway. Please confirm explicitly below. You can still return or choose
            Pre-Surgery Review if that better matches your situation—HairAudit will not silently pick a
            pathway for you.
          </p>
        </div>
      ) : null}
      {PATIENT_REVIEW_PATHWAYS.map((pathway) => {
        const def = PATIENT_PATHWAY_DEFINITIONS[pathway];
        const Icon = PATHWAY_ICONS[pathway];
        const highlightPost = donorEntryActive && pathway === "post_surgery";
        return (
          <article
            key={pathway}
            className={cn(
              "flex h-full flex-col rounded-2xl border bg-card/70 p-6 shadow-fi-panel",
              highlightPost ? "border-amber-400/50 ring-1 ring-amber-400/30" : "border-border/50"
            )}
            data-donor-entry-highlighted={highlightPost ? "true" : undefined}
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
                  {highlightPost
                    ? "Independent review after surgery, with donor healing questions and rear/left/right donor photo emphasis when you continue."
                    : t(def.marketingDescriptionKey as never)}
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
                entryContext={pathway === "post_surgery" ? donorEntryContext : undefined}
                eventName={`cta_start_pathway_${def.analyticsEventSuffix}`}
                className={cn(
                  fiHairauditPrimaryButtonClass("md"),
                  "w-full justify-center sm:w-auto"
                )}
              >
                {highlightPost
                  ? "Continue with Post-Surgery Audit"
                  : t(def.marketingCtaKey as never)}
              </StartFreeAuditButton>
            </div>
          </article>
        );
      })}
    </div>
  );
}
