"use client";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import SampleReportPatientGuidanceCallout from "@/components/marketing/SampleReportPatientGuidanceCallout";
import TrackedLink from "@/components/analytics/TrackedLink";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";

const PREVIEW_CARDS: { titleKey: TranslationKey; detailKey: TranslationKey }[] = [
  { titleKey: "marketing.sampleReport.cardOverviewTitle", detailKey: "marketing.sampleReport.cardOverviewDetail" },
  { titleKey: "marketing.sampleReport.cardRadarTitle", detailKey: "marketing.sampleReport.cardRadarDetail" },
  { titleKey: "marketing.sampleReport.cardImageTitle", detailKey: "marketing.sampleReport.cardImageDetail" },
  { titleKey: "marketing.sampleReport.cardFindingsTitle", detailKey: "marketing.sampleReport.cardFindingsDetail" },
];

const RADAR_ROWS: { labelKey: TranslationKey; score: number }[] = [
  { labelKey: "marketing.sampleReport.domainHairline", score: 74 },
  { labelKey: "marketing.sampleReport.domainDensity", score: 58 },
  { labelKey: "marketing.sampleReport.domainRecipient", score: 67 },
  { labelKey: "marketing.sampleReport.domainDonor", score: 52 },
  { labelKey: "marketing.sampleReport.domainNaturalness", score: 63 },
  { labelKey: "marketing.sampleReport.domainEvidence", score: 86 },
];

const SCORE_ROWS: { labelKey: TranslationKey; score: number }[] = [
  { labelKey: "marketing.sampleReport.scoreDesign", score: 71 },
  { labelKey: "marketing.sampleReport.scoreTechnique", score: 64 },
  { labelKey: "marketing.sampleReport.scoreDensity", score: 57 },
  { labelKey: "marketing.sampleReport.scoreDonorSafety", score: 54 },
  { labelKey: "marketing.sampleReport.scoreDocumentation", score: 88 },
];

const sampleFindings = [
  {
    title: "Hairline Design",
    insight:
      "Frontal line demonstrates asymmetry with abrupt angle transitions at temporal zones, reducing natural flow under direct light.",
    severity: "Moderate concern",
  },
  {
    title: "Density Distribution",
    insight:
      "Central forelock appears relatively preserved, while bilateral frontal thirds show under-density compared with expected graft allocation.",
    severity: "High concern",
  },
  {
    title: "Donor Management",
    insight:
      "Posterior donor extraction appears regionally concentrated with visible spacing inconsistency suggestive of over-harvest risk.",
    severity: "High concern",
  },
];

const sampleRecommendations = [
  "Obtain standardized 6-month and 12-month macro photography with matching angles and lighting for progression validation.",
  "Request operative records including graft count by zone and extraction map before considering corrective intervention.",
  "Perform in-person donor density quantification and elasticity assessment before repair planning.",
  "Prioritize conservative frontal refinement strategy to avoid compounding donor depletion.",
  "Preserve this report for second-opinion consultation, repair budgeting, or pre-dispute documentation workflow.",
];

const AUDIT_INCLUDE_KEYS = [
  "marketing.sampleReport.includesExecSummary",
  "marketing.sampleReport.includesScore",
  "marketing.sampleReport.includesImage",
  "marketing.sampleReport.includesAssess",
  "marketing.sampleReport.includesCorrection",
  "marketing.sampleReport.includesPdf",
] as const satisfies readonly TranslationKey[];

const MOTIVATION_KEYS = [
  "marketing.sampleReport.motivation1",
  "marketing.sampleReport.motivation2",
  "marketing.sampleReport.motivation3",
  "marketing.sampleReport.motivation4",
] as const satisfies readonly TranslationKey[];

function toRadarPoint(value: number, index: number, count: number, radius: number, center: number) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const scaled = (value / 100) * radius;
  return `${(center + Math.cos(angle) * scaled).toFixed(1)},${(center + Math.sin(angle) * scaled).toFixed(1)}`;
}

function radarAxisPoint(index: number, count: number, radius: number, center: number) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function IncludeIcon({ idx }: { idx: number }) {
  const color = "text-cyan-300";
  if (idx % 3 === 0) {
    return (
      <svg viewBox="0 0 24 24" className={`size-5 ${color}`} aria-hidden>
        <path d="M5 5h14v14H5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (idx % 3 === 1) {
    return (
      <svg viewBox="0 0 24 24" className={`size-5 ${color}`} aria-hidden>
        <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={`size-5 ${color}`} aria-hidden>
      <path d="M12 3l8 4v5c0 5.4-3.3 8.2-8 9-4.7-.8-8-3.6-8-9V7l8-4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.3 12.2l1.8 1.8 3.8-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function SampleReportMarketing() {
  const { t } = useI18n();
  const center = 110;
  const radius = 78;
  const axisCount = RADAR_ROWS.length;
  const radarPolygon = RADAR_ROWS.map((domain, index) =>
    toRadarPoint(domain.score, index, axisCount, radius, center)
  ).join(" ");
  const evidenceIntegrity = 84;
  const confidenceStrength = 79;

  const previewLabel = (n: number) =>
    t("marketing.sampleReport.previewN").replace(/\{\{n\}\}/g, String(n));

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(34,211,238,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_35%_at_88%_20%,rgba(129,140,248,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_48%_28%_at_20%_88%,rgba(59,130,246,0.10),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        <section className="px-4 sm:px-6 py-14 sm:py-18 lg:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                {t("marketing.sampleReport.heroBadge")}
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                {t("marketing.sampleReport.heroTitle")}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                {t("marketing.sampleReport.heroSubtitle")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <TrackedLink
                  href="/demo-report"
                  eventName="cta_view_sample_audit_hero"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:scale-[1.01]"
                >
                  {t("marketing.sampleReport.ctaViewSample")}
                </TrackedLink>
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_my_audit_hero"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:border-white/35 hover:bg-white/10"
                >
                  {t("marketing.sampleReport.ctaRequestAudit")}
                </TrackedLink>
              </div>
              <p className="mt-5 text-sm text-slate-400">{t("marketing.sampleReport.heroNote")}</p>
            </div>

            <div>
              <div className="relative mx-auto h-[380px] w-full max-w-[420px]">
                <div className="absolute right-0 top-4 h-72 w-56 rotate-6 rounded-2xl border border-cyan-200/20 bg-slate-900/75 p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/90">
                    {t("marketing.sampleReport.floatingEvidence")}
                  </p>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[84%] rounded-full bg-gradient-to-r from-cyan-300 to-indigo-300" />
                  </div>
                  <p className="mt-2 text-xs text-slate-300">{t("marketing.sampleReport.floatingDocConf")}</p>
                  <div className="mt-6 space-y-2">
                    <div className="h-8 rounded-lg bg-white/5" />
                    <div className="h-8 rounded-lg bg-white/5" />
                    <div className="h-8 rounded-lg bg-white/5" />
                  </div>
                </div>
                <div className="absolute left-2 top-16 h-72 w-56 -rotate-3 rounded-2xl border border-indigo-200/20 bg-slate-900/75 p-4 shadow-2xl shadow-indigo-950/40 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-200/90">
                    {t("marketing.sampleReport.floatingScorecard")}
                  </p>
                  <div className="mt-4 space-y-3">
                    {SCORE_ROWS.slice(0, 4).map((item) => (
                      <div key={item.labelKey}>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>{t(item.labelKey)}</span>
                          <span>{item.score}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/10">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-indigo-300 to-cyan-300"
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute inset-x-8 bottom-2 rounded-2xl border border-white/15 bg-slate-900/80 p-4 shadow-2xl shadow-black/45 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200">
                    {t("marketing.sampleReport.floatingCorrection")}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-rose-400/20 px-2 py-2 text-center text-[11px] text-rose-100">
                      {t("marketing.sampleReport.priorityHigh")}
                    </div>
                    <div className="rounded-lg bg-amber-400/20 px-2 py-2 text-center text-[11px] text-amber-100">
                      {t("marketing.sampleReport.priorityMedium")}
                    </div>
                    <div className="rounded-lg bg-emerald-400/20 px-2 py-2 text-center text-[11px] text-emerald-100">
                      {t("marketing.sampleReport.priorityLow")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-8 sm:pb-10">
          <div>
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-6 text-center backdrop-blur sm:flex-row sm:justify-between sm:text-left">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/90">
                  {t("marketing.sampleReport.midBannerEyebrow")}
                </p>
                <p className="mt-2 text-sm text-slate-300 sm:text-base">{t("marketing.sampleReport.midBannerBody")}</p>
              </div>
              <TrackedLink
                href="/request-review"
                eventName="cta_get_independent_review_mid"
                className="inline-flex items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-300/15 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/25"
              >
                {t("marketing.sampleReport.midBannerCta")}
              </TrackedLink>
            </div>
          </div>
        </section>

        <SampleReportPatientGuidanceCallout />

        <section id="inside-report" className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
                {t("marketing.sampleReport.insideEyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t("marketing.sampleReport.insideHeading")}
              </h2>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {PREVIEW_CARDS.map((card, index) => (
                <div key={card.titleKey}>
                  <article className="rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-[0_14px_50px_rgba(2,6,23,0.45)] backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.17em] text-cyan-200/80">{previewLabel(index + 1)}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{t(card.titleKey)}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{t(card.detailKey)}</p>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
                {t("marketing.sampleReport.visualsEyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t("marketing.sampleReport.visualsHeading")}
              </h2>
            </div>
            <div className="mt-9 grid gap-6 lg:grid-cols-2">
              <div>
                <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                  <h3 className="text-base font-semibold text-white">{t("marketing.sampleReport.chartRadarTitle")}</h3>
                  <p className="mt-1 text-sm text-slate-300">{t("marketing.sampleReport.chartRadarDesc")}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
                    <svg viewBox="0 0 220 220" className="h-[220px] w-full">
                      {[100, 75, 50, 25].map((ring) => (
                        <polygon
                          key={ring}
                          points={RADAR_ROWS.map((_, i) => toRadarPoint(ring, i, axisCount, radius, center)).join(
                            " "
                          )}
                          fill="none"
                          stroke="rgba(148,163,184,0.22)"
                        />
                      ))}
                      {RADAR_ROWS.map((_, i) => {
                        const axis = radarAxisPoint(i, axisCount, radius, center);
                        return (
                          <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={axis.x}
                            y2={axis.y}
                            stroke="rgba(148,163,184,0.2)"
                            strokeWidth="1"
                          />
                        );
                      })}
                      <polygon
                        points={radarPolygon}
                        fill="rgba(56,189,248,0.24)"
                        stroke="rgba(125,211,252,0.95)"
                        strokeWidth="2"
                      />
                      {RADAR_ROWS.map((domain, i) => {
                        const point = toRadarPoint(domain.score, i, axisCount, radius, center).split(",");
                        return (
                          <circle key={domain.labelKey} cx={Number(point[0])} cy={Number(point[1])} r="3.2" fill="rgb(103,232,249)" />
                        );
                      })}
                    </svg>
                    <div className="space-y-2">
                      {RADAR_ROWS.map((domain) => (
                        <div key={domain.labelKey}>
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>{t(domain.labelKey)}</span>
                            <span>{domain.score}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-white/10">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-cyan-300 to-indigo-300"
                              style={{ width: `${domain.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              </div>

              <div>
                <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                  <h3 className="text-base font-semibold text-white">{t("marketing.sampleReport.chartBreakdownTitle")}</h3>
                  <p className="mt-1 text-sm text-slate-300">{t("marketing.sampleReport.chartBreakdownDesc")}</p>
                  <div className="mt-5 space-y-3">
                    {SCORE_ROWS.map((item) => (
                      <div key={item.labelKey}>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                          <span>{t(item.labelKey)}</span>
                          <span>{item.score}</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-800">
                          <div
                            className="h-3 rounded-full bg-gradient-to-r from-sky-300 via-cyan-300 to-indigo-300 shadow-[0_0_18px_rgba(125,211,252,0.35)]"
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </div>

              <div>
                <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                  <h3 className="text-base font-semibold text-white">{t("marketing.sampleReport.meterTitle")}</h3>
                  <p className="mt-1 text-sm text-slate-300">{t("marketing.sampleReport.meterDesc")}</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                        {t("marketing.sampleReport.meterEvidenceLabel")}
                      </p>
                      <p className="mt-1 text-3xl font-semibold text-cyan-200">{evidenceIntegrity}%</p>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${evidenceIntegrity}%` }} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                        {t("marketing.sampleReport.meterConfidenceLabel")}
                      </p>
                      <p className="mt-1 text-3xl font-semibold text-indigo-200">{confidenceStrength}%</p>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-indigo-300" style={{ width: `${confidenceStrength}%` }} />
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <div>
                <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                  <h3 className="text-base font-semibold text-white">{t("marketing.sampleReport.correctionVisTitle")}</h3>
                  <p className="mt-1 text-sm text-slate-300">{t("marketing.sampleReport.correctionVisDesc")}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-rose-300/25 bg-rose-400/10 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-rose-200">
                        {t("marketing.sampleReport.correctionImmediateLabel")}
                      </p>
                      <p className="mt-2 text-sm text-slate-200">{t("marketing.sampleReport.correctionImmediateBody")}</p>
                    </div>
                    <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-amber-200">
                        {t("marketing.sampleReport.correctionNextLabel")}
                      </p>
                      <p className="mt-2 text-sm text-slate-200">{t("marketing.sampleReport.correctionNextBody")}</p>
                    </div>
                    <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">
                        {t("marketing.sampleReport.correctionDocLabel")}
                      </p>
                      <p className="mt-2 text-sm text-slate-200">{t("marketing.sampleReport.correctionDocBody")}</p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t("marketing.sampleReport.findingsSectionTitle")}
              </h2>
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {sampleFindings.map((finding) => (
                <div key={finding.title}>
                  <article className="rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/90">{finding.severity}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{finding.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{finding.insight}</p>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl rounded-3xl border border-white/12 bg-white/[0.03] p-6 sm:p-8">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t("marketing.sampleReport.recoSectionTitle")}
              </h2>
              <ul className="mt-6 space-y-3">
                {sampleRecommendations.map((recommendation, idx) => (
                  <li key={recommendation} className="flex gap-3 rounded-xl border border-white/10 bg-slate-900/55 px-4 py-3">
                    <span className="mt-1 inline-block size-2 shrink-0 rounded-full bg-cyan-300" aria-hidden />
                    <span className="text-sm text-slate-200">
                      <span className="mr-1 font-semibold text-white">R{idx + 1}.</span>
                      {recommendation}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t("marketing.sampleReport.includesSectionTitle")}
              </h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AUDIT_INCLUDE_KEYS.map((key, idx) => (
                <div key={key}>
                  <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-9 items-center justify-center rounded-lg border border-white/20 bg-white/[0.06]">
                        <IncludeIcon idx={idx} />
                      </span>
                      <h3 className="text-base font-semibold text-white">{t(key)}</h3>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t("marketing.sampleReport.motivationsTitle")}
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {MOTIVATION_KEYS.map((key) => (
                <div key={key}>
                  <article className="rounded-2xl border border-white/12 bg-slate-900/60 p-5">
                    <p className="text-sm leading-relaxed text-slate-200">{t(key)}</p>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-5xl rounded-3xl border border-cyan-300/25 bg-gradient-to-r from-cyan-400/10 via-indigo-400/10 to-slate-900 p-8 text-center shadow-2xl shadow-cyan-950/35">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">{t("marketing.sampleReport.footerEyebrow")}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t("marketing.sampleReport.footerTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-200 sm:text-base">
                {t("marketing.sampleReport.footerBody")}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_my_audit_footer"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  {t("marketing.sampleReport.footerCtaPrimary")}
                </TrackedLink>
                <TrackedLink
                  href="/request-review"
                  eventName="cta_get_independent_review_footer"
                  className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {t("marketing.sampleReport.footerCtaSecondary")}
                </TrackedLink>
              </div>
              <div className="mx-auto mt-8 max-w-3xl text-left">
                <ReviewProcessReassurance />
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
