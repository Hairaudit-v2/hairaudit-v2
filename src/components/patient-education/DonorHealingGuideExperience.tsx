"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { trackCta } from "@/lib/analytics/trackCta";
import {
  DONOR_HEALING_GUIDE_SLUG,
  donorHealingAnalyticsMeta,
} from "@/lib/patient/donorHealingEntry";
import { stashPendingEntryContext } from "@/lib/patient/patientEntryContext";
import {
  DONOR_HEALING_CAPABILITY,
  DONOR_HEALING_COMPARISON_CARDS,
  DONOR_HEALING_CTA_SUPPORTING,
  DONOR_HEALING_OPENING_HOOK,
  DONOR_HEALING_OPENING_SUPPORT,
  DONOR_HEALING_PHOTO_PREP,
  DONOR_HEALING_STAGE_ROUTES,
  DONOR_HEALING_TIMELINE,
} from "@/lib/seo/donorHealingGuideContent";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { cn } from "@/lib/utils";
import { networkButtonVariants } from "@/packages/ui";

type DonorHealingGuideExperienceProps = {
  ctaLabel: string;
  ctaHref: string;
  ctaAnalyticsId: string;
  ctaDestination: string;
  guideSlug?: string;
  finalCtaLabel?: string;
};

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function DonorCtaBlock({
  label,
  href,
  analyticsId,
  destination,
  guideSlug,
  supporting,
  testId,
  onClick,
}: {
  label: string;
  href: string;
  analyticsId: string;
  destination: string;
  guideSlug: string;
  supporting: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-transparent p-5 sm:p-6">
      <p className="text-sm leading-relaxed text-muted-foreground">{supporting}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={href}
          onClick={onClick}
          className={fiHairauditPrimaryButtonClass("md")}
          data-testid={testId}
          data-cta={analyticsId}
          data-cta-destination={destination}
          data-patient-guide={guideSlug}
          data-entry-context="donor_healing"
        >
          {label}
        </Link>
        <Link
          href="/demo-report"
          className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
          data-cta="donor-secondary-sample-report"
          data-cta-destination="/demo-report"
        >
          View sample report
        </Link>
        <Link
          href="/how-it-works"
          className={cn(networkButtonVariants({ variant: "ghost", size: "md" }))}
          data-cta="donor-secondary-how-it-works"
          data-cta-destination="/how-it-works"
        >
          How HairAudit works
        </Link>
      </div>
    </div>
  );
}

export default function DonorHealingGuideExperience({
  ctaLabel,
  ctaHref,
  ctaAnalyticsId,
  ctaDestination,
  guideSlug = DONOR_HEALING_GUIDE_SLUG,
  finalCtaLabel = "Start My Donor Review",
}: DonorHealingGuideExperienceProps) {
  const baseId = useId();
  const [expandedStageId, setExpandedStageId] = useState<string | null>(
    DONOR_HEALING_TIMELINE[0]?.id ?? null
  );

  useEffect(() => {
    trackCta("donor_guide_viewed", donorHealingAnalyticsMeta({ guide: guideSlug }));
  }, [guideSlug]);

  function onStageRouteSelect(
    routeId: "early" | "later",
    stageGroup: "under_3_months" | "3_months_or_more",
    anchorId: string
  ) {
    trackCta(
      "donor_stage_selected",
      donorHealingAnalyticsMeta({ stage_route: routeId, stage_group: stageGroup })
    );
    scrollToId(anchorId);
  }

  function onTimelineToggle(stageId: string) {
    setExpandedStageId((prev) => {
      const next = prev === stageId ? null : stageId;
      if (next) {
        trackCta(
          "donor_timeline_stage_opened",
          donorHealingAnalyticsMeta({ stage_id: stageId })
        );
      }
      return next;
    });
  }

  function onCtaClick() {
    stashPendingEntryContext({
      entryContext: "donor_healing",
      concern: "donor_healing",
      sourceGuide: guideSlug,
      recommendedPathway: "post_surgery",
    });
    trackCta(
      ctaAnalyticsId || "donor_cta_clicked",
      donorHealingAnalyticsMeta({
        href: ctaHref,
        destination: ctaDestination,
      })
    );
  }

  return (
    <div
      className="mx-auto mt-8 max-w-3xl space-y-10 sm:mt-10 sm:space-y-12"
      data-analytics-scope="donor-healing-guide"
      data-patient-guide={guideSlug}
      data-entry-context="donor_healing"
      data-testid="donor-healing-experience"
    >
      <section
        aria-labelledby={`${baseId}-opening`}
        className="rounded-2xl border border-border/50 bg-card/60 px-4 py-5 sm:px-6 sm:py-6"
        data-testid="donor-opening-viewport"
      >
        <h2 id={`${baseId}-opening`} className="text-xl font-semibold text-foreground sm:text-2xl">
          {DONOR_HEALING_OPENING_HOOK}
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">{DONOR_HEALING_OPENING_SUPPORT}</p>

        <div className="mt-6 space-y-3" aria-labelledby={`${baseId}-stage-routes`}>
          <h3 id={`${baseId}-stage-routes`} className="text-base font-semibold text-foreground">
            Where are you in healing?
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            These choices scroll to the most relevant timeline section. They do not start a case.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DONOR_HEALING_STAGE_ROUTES.map((route) => (
              <button
                key={route.id}
                type="button"
                onClick={() => onStageRouteSelect(route.id, route.stageGroup, route.anchorId)}
                className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-left transition-colors hover:border-amber-300/50 hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                data-testid={`donor-stage-route-${route.id}`}
                data-cta={`donor-stage-route-${route.id}`}
                aria-describedby={`${baseId}-route-${route.id}-desc`}
              >
                <span className="block text-base font-semibold text-foreground">{route.label}</span>
                <span
                  id={`${baseId}-route-${route.id}-desc`}
                  className="mt-2 block text-sm leading-relaxed text-muted-foreground"
                >
                  {route.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <DonorCtaBlock
            label={ctaLabel}
            href={ctaHref}
            analyticsId={ctaAnalyticsId}
            destination={ctaDestination}
            guideSlug={guideSlug}
            supporting={DONOR_HEALING_CTA_SUPPORTING}
            testId="donor-healing-cta"
            onClick={onCtaClick}
          />
        </div>
      </section>

      <section
        aria-labelledby={`${baseId}-capability`}
        className="space-y-4"
        data-testid="donor-capability-boundary"
      >
        <h2 id={`${baseId}-capability`} className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          What HairAudit can and cannot assess from photographs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/50 bg-card/50 px-4 py-4 sm:px-5">
            <h3 className="text-base font-semibold text-foreground">HairAudit can help assess</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {DONOR_HEALING_CAPABILITY.canHelp.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/50 px-4 py-4 sm:px-5">
            <h3 className="text-base font-semibold text-foreground">
              HairAudit cannot confirm from photographs alone
            </h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {DONOR_HEALING_CAPABILITY.cannotConfirm.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="donor-healing-timeline"
        aria-labelledby={`${baseId}-timeline`}
        className="scroll-mt-24 space-y-4"
      >
        <div id="donor-healing-early" className="scroll-mt-24" />
        <h2 id={`${baseId}-timeline`} className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          FUE donor healing timeline
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use bounded language as a guide: what patients may commonly notice, what is too early to
          judge, what deserves routine follow-up, and when direct clinical care is wiser than photo
          review alone.
        </p>
        <div className="space-y-3" role="list">
          {DONOR_HEALING_TIMELINE.map((stage, index) => {
            const expanded = expandedStageId === stage.id;
            const panelId = `${baseId}-stage-panel-${stage.id}`;
            const laterAnchor = stage.id === "months_3_4";
            return (
              <div
                key={stage.id}
                role="listitem"
                id={laterAnchor ? "donor-healing-later" : undefined}
                className={cn(
                  "rounded-2xl border border-border/50 bg-card/50",
                  laterAnchor && "scroll-mt-24"
                )}
              >
                <h3 className="m-0">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300/60 sm:px-5"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    data-testid={`donor-timeline-stage-${stage.id}`}
                    onClick={() => onTimelineToggle(stage.id)}
                  >
                    <span>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                        Stage {index + 1} · {stage.rangeLabel}
                      </span>
                      <span className="mt-1 block text-base font-semibold text-foreground">
                        {stage.label}
                      </span>
                    </span>
                    <span className="mt-1 text-sm text-muted-foreground" aria-hidden>
                      {expanded ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  hidden={!expanded}
                  className="border-t border-border/40 px-4 pb-4 pt-3 sm:px-5 sm:pb-5"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        What patients may commonly notice
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                        {stage.commonlyNotice.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        What is too early to judge
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                        {stage.cannotYetJudge.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        What deserves routine follow-up
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                        {stage.mayDeserveFollowUp.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-rose-300/90">
                        When to seek direct clinical care
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                        {stage.seekDirectClinicalCare.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <DonorCtaBlock
        label={ctaLabel}
        href={ctaHref}
        analyticsId={ctaAnalyticsId}
        destination={ctaDestination}
        guideSlug={guideSlug}
        supporting="After early or later healing guidance, you can begin a donor-focused Post-Surgery Audit. Pathway confirmation is still required."
        testId="donor-healing-cta-mid"
        onClick={onCtaClick}
      />

      <section aria-labelledby={`${baseId}-compare`} className="space-y-4">
        <h2 id={`${baseId}-compare`} className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Often compatible with the healing stage, deserves closer review, or seek direct clinical advice
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          These cards do not confirm normality or overharvesting. They help separate stage-compatible
          appearances from patterns that may deserve closer attention.
        </p>
        <div className="grid gap-4">
          {DONOR_HEALING_COMPARISON_CARDS.map((card) => (
            <article
              key={card.id}
              className="overflow-hidden rounded-2xl border border-border/50 bg-card/50"
              data-testid={`donor-compare-${card.id}`}
            >
              <h3 className="border-b border-border/40 px-4 py-3 text-base font-semibold text-foreground sm:px-5">
                {card.domain}
              </h3>
              <div className="grid gap-0 sm:grid-cols-3">
                <div className="border-b border-border/30 px-4 py-3 sm:border-b-0 sm:border-r sm:px-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90">
                    Often compatible with the healing stage
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {card.oftenCompatible}
                  </p>
                </div>
                <div className="border-b border-border/30 px-4 py-3 sm:border-b-0 sm:border-r sm:px-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                    Deserves closer review
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {card.deservesReview}
                  </p>
                </div>
                <div className="px-4 py-3 sm:px-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-300/90">
                    Seek direct clinical advice
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {card.seekClinicalAdvice}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="donor-photo-prep"
        aria-labelledby={`${baseId}-photos`}
        className="scroll-mt-24 space-y-4"
      >
        <h2 id={`${baseId}-photos`} className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {DONOR_HEALING_PHOTO_PREP.heading}
        </h2>
        <p className="leading-relaxed text-muted-foreground">{DONOR_HEALING_PHOTO_PREP.intro}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {DONOR_HEALING_PHOTO_PREP.requiredViews.map((view) => (
            <div
              key={view.id}
              className="rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-4"
            >
              <p className="text-sm font-semibold text-foreground">{view.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{view.detail}</p>
            </div>
          ))}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {DONOR_HEALING_PHOTO_PREP.optionalViews.map((view) => (
            <li
              key={view.id}
              className="rounded-xl border border-border/40 bg-card/40 px-4 py-3 text-sm text-muted-foreground"
            >
              <span className="font-medium text-foreground">{view.title}: </span>
              {view.detail}
            </li>
          ))}
        </ul>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {DONOR_HEALING_PHOTO_PREP.techniqueTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby={`${baseId}-cta-final`}
        data-analytics-region="donor-healing-primary-cta"
        data-testid="donor-final-cta"
      >
        <h2 id={`${baseId}-cta-final`} className="sr-only">
          Start a donor-focused review
        </h2>
        <DonorCtaBlock
          label={finalCtaLabel}
          href={ctaHref}
          analyticsId={ctaAnalyticsId}
          destination={ctaDestination}
          guideSlug={guideSlug}
          supporting="Start My Donor Review still requires explicit Post-Surgery Audit confirmation. HairAudit will not invent a third pathway or declare overharvesting from this page."
          testId="donor-healing-cta-final"
          onClick={onCtaClick}
        />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground" role="note">
          HairAudit does not confirm a &quot;normal donor,&quot; diagnose infection, or calculate safe
          remaining graft capacity from photographs alone.
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap">
          <li>
            <Link
              href="/overharvested-donor-area"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Read donor overharvesting guidance
            </Link>
          </li>
          <li>
            <Link
              href="/what-photos-are-needed-for-a-proper-hair-transplant-review"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Photo preparation guide
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
