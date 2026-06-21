import Link from "next/link";
import { ArrowUpRight, Cpu, Layers, ShieldCheck, Sparkles } from "lucide-react";

import IntelligenceModuleCard from "@/components/platform/IntelligenceModuleCard";
import ProgressStatusBadge from "@/components/platform/ProgressStatusBadge";
import {
  ENGINEERING_CHANGELOG,
  INTELLIGENCE_MODULES,
  PATIENT_EXPERIENCE_ENGINE,
  PATIENT_QA_ENGINE,
  PATIENT_QA_ROLLUPS,
  PLATFORM_CAPABILITY_ROLLUPS,
  PATIENT_PATHWAY_INFRASTRUCTURE,
  PATIENT_UX_FEATURES,
  PLATFORM_MISSION,
  type ModuleStatus,
} from "@/content/platformProgress";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { cn } from "@/lib/utils";
import {
  Badge,
  FeatureGrid,
  MetricCard,
  NetworkHero,
  Section,
  Timeline,
  networkButtonVariants,
} from "@/packages/ui";

function formatChangelogDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function computeModuleSummary() {
  const liveOrProduction = INTELLIGENCE_MODULES.filter(
    (m) => m.status === "Live" || m.status === "Production"
  ).length;
  const averageCompletion = Math.round(
    INTELLIGENCE_MODULES.reduce((sum, m) => sum + m.completionPercent, 0) / INTELLIGENCE_MODULES.length
  );
  const inDevelopment = INTELLIGENCE_MODULES.filter((m) => m.status === "Active Development").length;

  return { liveOrProduction, averageCompletion, inDevelopment };
}

const areaBadgeTone: Record<(typeof ENGINEERING_CHANGELOG)[number]["area"], "neutral" | "accent" | "success"> = {
  Intelligence: "accent",
  "Patient Experience": "success",
  Infrastructure: "neutral",
  Platform: "neutral",
};

export default function PlatformProgressPage() {
  const summary = computeModuleSummary();

  return (
    <main id="main-content" className="relative flex-1">
      <NetworkHero
        platform="hairaudit"
        eyebrow="Platform engineering"
        title="HairAudit intelligence infrastructure — built in public."
        subtitle="Live progress on clinical intelligence modules, patient experience workstreams, and shipped platform updates. Percentages and statuses are updated manually as engineering milestones land."
        networkLabel="HairAudit · Engineering progress"
        actions={
          <>
            <Link href={PATHWAY_CHOOSER_HREF} className={fiHairauditPrimaryButtonClass("lg")}>
              {PUBLIC_CTAS.startFreeHairAudit}
            </Link>
            <Link
              href="/professionals"
              className={cn(networkButtonVariants({ variant: "secondary", size: "lg" }))}
              prefetch
            >
              Professional standards
            </Link>
          </>
        }
        aside={
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-fi-panel backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Intelligence grid snapshot
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live / production</p>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-foreground">
                  {summary.liveOrProduction}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">of {INTELLIGENCE_MODULES.length} modules</p>
              </div>
              <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Avg completion</p>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-foreground">
                  {summary.averageCompletion}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">intelligence modules</p>
              </div>
              <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">In development</p>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-foreground">
                  {summary.inDevelopment}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">active modules</p>
              </div>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              Updated from{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-foreground/90">
                src/content/platformProgress.ts
              </code>
              . Engineering culture: ship, measure, publish.
            </p>
          </div>
        }
      />

      <Section id="mission" className="border-t border-border/30" aria-labelledby="mission-heading">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-4">
            <Badge tone="accent">Mission</Badge>
            <h2 id="mission-heading" className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {PLATFORM_MISSION.headline}
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{PLATFORM_MISSION.body}</p>
          </div>
          <div className="rounded-3xl border border-border/50 bg-card/60 p-6 shadow-fi-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Operating principles</p>
            <ul className="mt-5 space-y-4">
              {PLATFORM_MISSION.principles.map((principle) => (
                <li key={principle} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
                  {principle}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="intelligence" className="border-t border-border/30" aria-labelledby="intelligence-heading">
        <div className="space-y-10">
          <div className="max-w-3xl space-y-3">
            <Badge tone="neutral">
              <span className="inline-flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5" aria-hidden />
                Intelligence Engine
              </span>
            </Badge>
            <h2 id="intelligence-heading" className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Intelligence Engine progress grid
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Eight core modules powering HairAudit procedural analytics, donor and recipient review, and outcome
              signals. Completion percentages reflect engineering readiness — not marketing claims.
            </p>
          </div>

          <FeatureGrid columnsClassName="md:grid-cols-2 xl:grid-cols-4">
            {INTELLIGENCE_MODULES.map((module) => (
              <IntelligenceModuleCard key={module.id} module={module} />
            ))}
          </FeatureGrid>

          <div className="flex flex-wrap gap-2 border-t border-border/30 pt-8">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status legend</span>
            {(
              [
                "Live",
                "Production",
                "Pilot Ready",
                "Active Development",
                "Infrastructure Complete",
              ] as ModuleStatus[]
            ).map((status) => (
              <ProgressStatusBadge key={status} status={status} />
            ))}
          </div>
        </div>
      </Section>

      <Section id="patient-experience" className="border-t border-border/30" aria-labelledby="patient-ux-heading">
        <div className="space-y-10">
          <div className="max-w-3xl space-y-3">
            <Badge tone="success">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Patient experience
              </span>
            </Badge>
            <h2 id="patient-ux-heading" className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Patient experience progress
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              UX surfaces actively being improved — intake clarity, report readability, and accessibility for global
              patients seeking independent review.
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.06] p-6 shadow-fi-panel sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/90">
                  Engine rollup
                </p>
                <h3 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                  {PATIENT_EXPERIENCE_ENGINE.name}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {PATIENT_EXPERIENCE_ENGINE.description}
                </p>
              </div>
              <span className="font-display text-4xl font-semibold tabular-nums text-foreground sm:text-5xl">
                {PATIENT_EXPERIENCE_ENGINE.completionPercent}%
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300/90 to-sky-300/90"
                style={{ width: `${PATIENT_EXPERIENCE_ENGINE.completionPercent}%` }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PLATFORM_CAPABILITY_ROLLUPS.map((feature) => (
              <article
                key={feature.id}
                className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5 shadow-fi-panel sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">{feature.name}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {feature.focus}
                    </p>
                  </div>
                  <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                    {feature.completionPercent}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300/80 to-emerald-300/80"
                    style={{ width: `${feature.completionPercent}%` }}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {PATIENT_PATHWAY_INFRASTRUCTURE.map((feature) => (
              <article
                key={feature.id}
                className="rounded-2xl border border-border/50 bg-card/65 p-5 shadow-fi-panel sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">{feature.name}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {feature.focus}
                    </p>
                  </div>
                  <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                    {feature.completionPercent}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300/80 to-sky-300/80"
                    style={{ width: `${feature.completionPercent}%` }}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {PATIENT_UX_FEATURES.map((feature) => (
              <article
                key={feature.id}
                className="rounded-2xl border border-border/50 bg-card/65 p-5 shadow-fi-panel sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">{feature.name}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {feature.focus}
                    </p>
                  </div>
                  <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                    {feature.completionPercent}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300/80 to-sky-300/80"
                    style={{ width: `${feature.completionPercent}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section id="patient-qa" className="border-t border-border/30" aria-labelledby="patient-qa-heading">
        <div className="space-y-10">
          <div className="max-w-3xl space-y-3">
            <Badge tone="neutral">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Quality assurance
              </span>
            </Badge>
            <h2 id="patient-qa-heading" className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Patient journey QA coverage
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Browser-level verification of the dual-pathway patient experience — reports, pathway routing, uploads,
              waiting screens, PDF delivery, and mobile layouts.
            </p>
          </div>

          <div className="rounded-3xl border border-sky-300/20 bg-sky-300/[0.06] p-6 shadow-fi-panel sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/90">QA rollup</p>
                <h3 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                  {PATIENT_QA_ENGINE.name}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {PATIENT_QA_ENGINE.description}
                </p>
              </div>
              <span className="font-display text-4xl font-semibold tabular-nums text-foreground sm:text-5xl">
                {PATIENT_QA_ENGINE.completionPercent}%
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-300/90 to-emerald-300/90"
                style={{ width: `${PATIENT_QA_ENGINE.completionPercent}%` }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PATIENT_QA_ROLLUPS.map((metric) => (
              <article
                key={metric.id}
                className="rounded-2xl border border-sky-300/15 bg-sky-300/[0.04] p-5 shadow-fi-panel sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">{metric.name}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {metric.focus}
                    </p>
                  </div>
                  <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                    {metric.completionPercent}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{metric.description}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-300/80 to-emerald-300/80"
                    style={{ width: `${metric.completionPercent}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section id="changelog" className="border-t border-border/30" aria-labelledby="changelog-heading">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="space-y-4 lg:sticky lg:top-24">
            <Badge tone="neutral">
              <span className="inline-flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" aria-hidden />
                Changelog
              </span>
            </Badge>
            <h2 id="changelog-heading" className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Public engineering changelog
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Chronological record of shipped platform work — intelligence modules, patient UX, and infrastructure
              milestones.
            </p>
            <MetricCard
              label="Latest ship"
              value={formatChangelogDate(ENGINEERING_CHANGELOG[0]?.date ?? "")}
              hint={ENGINEERING_CHANGELOG[0]?.title}
            />
          </div>

          <div className="rounded-3xl border border-border/50 bg-card/50 p-6 sm:p-8">
            <Timeline
              items={ENGINEERING_CHANGELOG.map((entry) => ({
                title: entry.title,
                meta: (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>{formatChangelogDate(entry.date)}</span>
                    <Badge tone={areaBadgeTone[entry.area]} className="normal-case tracking-normal">
                      {entry.area}
                    </Badge>
                  </span>
                ),
                description: entry.description,
              }))}
            />
          </div>
        </div>
      </Section>

      <Section className="border-t border-border/30">
        <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-white/[0.06] via-card/70 to-transparent p-8 text-center shadow-fi-panel sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Stay close to the build</p>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Independent review, engineered in the open.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            HairAudit publishes progress so patients and professionals can see how clinical intelligence and patient
            experience evolve — with the rigor expected of enterprise medical infrastructure.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={PATHWAY_CHOOSER_HREF} className={fiHairauditPrimaryButtonClass("lg")}>
              {PUBLIC_CTAS.startFreeHairAudit}
            </Link>
            <Link
              href="/"
              className={cn(
                networkButtonVariants({ variant: "ghost", size: "lg" }),
                "inline-flex items-center gap-1.5"
              )}
            >
              Back to homepage
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Section>
    </main>
  );
}
