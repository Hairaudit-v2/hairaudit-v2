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
  DONOR_HEALING_COMPARISON_CARDS,
  DONOR_HEALING_PHOTO_PREP,
  DONOR_HEALING_REASSURANCE,
  DONOR_HEALING_STAGE_ROUTES,
  DONOR_HEALING_TIMELINE,
} from "@/lib/seo/donorHealingGuideContent";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { cn } from "@/lib/utils";

type DonorHealingGuideExperienceProps = {
  ctaLabel: string;
  ctaHref: string;
  ctaAnalyticsId: string;
  ctaDestination: string;
  guideSlug?: string;
};

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function DonorHealingGuideExperience({
  ctaLabel,
  ctaHref,
  ctaAnalyticsId,
  ctaDestination,
  guideSlug = DONOR_HEALING_GUIDE_SLUG,
}: DonorHealingGuideExperienceProps) {
  const baseId = useId();
  const [expandedStageId, setExpandedStageId] = useState<string | null>(
    DONOR_HEALING_TIMELINE[0]?.id ?? null
  );

  useEffect(() => {
    trackCta("donor_guide_viewed", donorHealingAnalyticsMeta({ guide: guideSlug }));
  }, [guideSlug]);

  function onStageRouteSelect(routeId: "early" | "later", anchorId: string) {
    trackCta(
      routeId === "early" ? "donor_stage_card_early" : "donor_stage_card_later",
      donorHealingAnalyticsMeta({ stage_route: routeId })
    );
    scrollToId(anchorId);
  }

  function onTimelineToggle(stageId: string) {
    setExpandedStageId((prev) => {
      const next = prev === stageId ? null : stageId;
      if (next) {
        trackCta("donor_timeline_stage_expanded", donorHealingAnalyticsMeta({ stage_id: stageId }));
      }
      return next;
    });
  }

  function onCtaClick() {
    stashPendingEntryContext({
      entryContext: "donor_healing",
      concern: "donor_healing",
      sourceGuide: guideSlug,
    });
    trackCta(
      ctaAnalyticsId,
      donorHealingAnalyticsMeta({
        href: ctaHref,
        destination: ctaDestination,
      })
    );
  }

  return (
    <div
      className="mx-auto mt-10 max-w-3xl space-y-10 sm:space-y-12"
      data-analytics-scope="donor-healing-guide"
      data-patient-guide={guideSlug}
      data-entry-context="donor_healing"
    >
      <section
        aria-labelledby={`${baseId}-reassurance`}
        className="rounded-2xl border border-border/50 bg-card/60 px-4 py-5 sm:px-6 sm:py-6"
      >
        <h2 id={`${baseId}-reassurance`} className="text-lg font-semibold text-foreground sm:text-xl">
          A cautious starting point
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">{DONOR_HEALING_REASSURANCE}</p>
      </section>

      <section aria-labelledby={`${baseId}-stage-routes`} className="space-y-4">
        <h2 id={`${baseId}-stage-routes`} className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Where are you in healing?
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          These routes help you find the most relevant timeline section. They do not start a case until
          you choose to begin a review.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {DONOR_HEALING_STAGE_ROUTES.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => onStageRouteSelect(route.id, route.anchorId)}
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
          Use bounded language as a guide: what patients often notice, what cannot yet be judged
          reliably, and when direct clinical advice may be wiser than photo review alone.
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
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Often noticed
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                        {stage.commonlyNotice.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Not enough evidence yet
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                        {stage.cannotYetJudge.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        May deserve clinic follow-up
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                        {stage.mayDeserveFollowUp.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {stage.urgentNote ? (
                    <p
                      className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/5 px-3 py-2 text-sm leading-relaxed text-rose-100/90"
                      role="note"
                    >
                      {stage.urgentNote}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby={`${baseId}-compare`} className="space-y-4">
        <h2 id={`${baseId}-compare`} className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Often compatible, deserves review, or seek clinical advice
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          These cards do not confirm normality or overharvesting. They help separate common healing
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
                    Often compatible with healing stage
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
        aria-labelledby={`${baseId}-cta`}
        className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-transparent p-6 sm:p-8"
        data-analytics-region="donor-healing-primary-cta"
      >
        <h2 id={`${baseId}-cta`} className="text-xl font-semibold text-foreground">
          Ready for a donor-focused independent review?
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Check My Donor Healing routes into HairAudit&apos;s Post-Surgery Audit. You will still confirm
          your review type before a case is created—this is not a separate pathway.
        </p>
        <div className="mt-6">
          <Link
            href={ctaHref}
            onClick={onCtaClick}
            className={fiHairauditPrimaryButtonClass("md")}
            data-testid="donor-healing-cta"
            data-cta={ctaAnalyticsId}
            data-cta-destination={ctaDestination}
            data-patient-guide={guideSlug}
            data-entry-context="donor_healing"
          >
            {ctaLabel}
          </Link>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground" role="note">
          HairAudit does not confirm a &quot;normal donor,&quot; diagnose infection, or calculate safe
          remaining graft capacity from photographs alone.
        </p>
      </section>
    </div>
  );
}
