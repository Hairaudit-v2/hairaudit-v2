"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Sparkline from "@/components/ui/Sparkline";
import {
  auditCompletionPipelineDemo,
  casesOverTimeDemo,
  DOMAIN_LABELS,
  doctorProfileDemo,
  doctorPerformanceTimelineDemo,
  createSubmissionSnapshot,
  defaultSurgicalProfileDemo,
  doctorCasesDemo,
  getDefaultProfileCompletion,
  getPerformanceDomains,
  getRecommendedModulesFromCases,
  getTrainingIntelligenceFromDomainScores,
  resolveCaseSettingsFromLayers,
  outcomesByStatusDemo,
  previousCaseOverrideTemplates,
  publicVsInternalDemo,
  scoreTrendDemo,
  strengthDistributionDemo,
  trainingModulesDemo,
  VISIBILITY_OPTIONS,
  type DoctorCaseDemo,
  type DoctorCaseOverride,
  type DoctorDefaultSurgicalProfile,
  type DoctorReportVisibility,
  type PerformanceDomainCode,
  type PerformanceDomainMetric,
  type TrainingDomain,
} from "@/lib/doctorPortal/demoData";

type KpiStat = { label: string; value: string; detail?: string };
type CaseReadinessResult = {
  percentage: number;
  missingEvidence: string[];
  suggestions: string[];
};

function cardClassName(extra?: string) {
  return `rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)] ${extra ?? ""}`;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
    </div>
  );
}

function IconBubble({ kind }: { kind: "upload" | "defaults" | "reports" | "training" | "profile" | "stats" }) {
  const iconByKind: Record<string, string> = {
    upload: "M12 3v12m0 0l4-4m-4 4l-4-4M5 20h14",
    defaults: "M4 7h16M7 12h10M9 17h6",
    reports: "M8 7h8M8 11h8M8 15h5M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    training: "M12 5l8 4-8 4-8-4 8-4zm0 8v6m-8-6v6m16-6v6",
    profile: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 8a7 7 0 0 1 14 0",
    stats: "M4 16l4-4 3 3 6-7",
  };
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconByKind[kind]} />
      </svg>
    </span>
  );
}

export function DoctorVisibilityBadge({ visibility }: { visibility: DoctorReportVisibility }) {
  const classes: Record<DoctorReportVisibility, string> = {
    INTERNAL: "border-slate-200 bg-slate-100 text-slate-700",
    PUBLIC_PENDING_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
    PUBLIC_APPROVED: "border-cyan-200 bg-cyan-50 text-cyan-800",
    PUBLIC_LIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[visibility]}`}>
      {visibility.replaceAll("_", " ")}
    </span>
  );
}

export function DoctorHeroSummary() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-white via-cyan-50/40 to-emerald-50/40 p-6 sm:p-8">
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Doctor workspace</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">Fast uploads. Better audits. Stronger discoverability.</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Save your surgical defaults once, apply them automatically, and only override what changed. Each case stays fast while your
          quality intelligence becomes richer over time.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/dashboard/doctor/upload" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Upload New Case
          </Link>
          <Link
            href="/dashboard/doctor/defaults"
            className="rounded-xl border border-cyan-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyan-700 hover:bg-cyan-50"
          >
            Review Default Profile
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">Profile completion 82%</span>
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">Defaults completion 92%</span>
          <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">2 cases need input</span>
        </div>
      </div>
    </section>
  );
}

export function DoctorNeedsInputPanel({ cases = doctorCasesDemo }: { cases?: DoctorCaseDemo[] }) {
  const needsInputCases = cases.filter((c) => c.needsInput || c.internalNotesPending);
  return (
    <section className={cardClassName("border-amber-200 bg-amber-50/70")}>
      <SectionTitle title="Needs Input" subtitle="Prioritized actions to keep report velocity high." />
      {needsInputCases.length === 0 ? (
        <p className="text-sm text-amber-900">All clear. No blocked audits right now.</p>
      ) : (
        <ul className="space-y-2">
          {needsInputCases.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                <p className="text-xs text-slate-600">{c.patientReference}</p>
              </div>
              <Link href="/dashboard/doctor/reports" className="text-xs font-semibold text-amber-800 hover:text-amber-900">
                Add input
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DoctorQuickStats({ stats }: { stats: KpiStat[] }) {
  return (
    <section>
      <SectionTitle title="KPI Snapshot" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <article key={s.label} className={cardClassName()}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
              <IconBubble kind="stats" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{s.value}</p>
            {s.detail ? <p className="mt-1 text-xs text-slate-500">{s.detail}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function MiniBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100">
            <div className="h-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DoctorScoreTrendChart() {
  return (
    <section className={cardClassName()}>
      <SectionTitle title="Score Trend" subtitle="Rolling performance over recent completed audits." />
      <Sparkline values={scoreTrendDemo} width={460} height={130} strokeClassName="text-cyan-600" fillClassName="text-cyan-200/40" />
    </section>
  );
}

export function DoctorCaseStatusChart() {
  return (
    <section className={cardClassName()}>
      <SectionTitle title="Audit Outcomes by Status" />
      <MiniBarChart data={outcomesByStatusDemo.map((d) => ({ label: d.status, value: d.value }))} />
    </section>
  );
}

export function DoctorStrengthDistribution() {
  return (
    <section className={cardClassName()}>
      <SectionTitle title="Strength Distribution by Domain" />
      <MiniBarChart data={strengthDistributionDemo.map((d) => ({ label: d.domain, value: d.value }))} />
    </section>
  );
}

export function DoctorAuditCompletionPipeline() {
  const max = Math.max(...auditCompletionPipelineDemo.map((item) => item.value), 1);
  const colorClass = (color: string) => {
    if (color === "cyan") return "bg-cyan-500";
    if (color === "amber") return "bg-amber-500";
    if (color === "emerald") return "bg-emerald-500";
    if (color === "violet") return "bg-violet-500";
    return "bg-slate-500";
  };

  const started = auditCompletionPipelineDemo[0]?.value ?? 1;
  const completed = auditCompletionPipelineDemo.find((item) => item.stage === "Completed")?.value ?? 0;
  const completionRate = Math.round((completed / Math.max(started, 1)) * 100);

  return (
    <section className={cardClassName()}>
      <SectionTitle title="Audit Completion Pipeline" subtitle="How cases progress from draft to trust-building outcomes." />
      <div className="space-y-2">
        {auditCompletionPipelineDemo.map((item) => (
          <div key={item.stage}>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>{item.stage}</span>
              <span className="font-semibold text-slate-700">{item.value}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100">
              <div className={`h-2.5 rounded-full ${colorClass(item.color)}`} style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        Completion efficiency: <span className="font-semibold">{completionRate}%</span> of draft cases reach completed audits.
      </div>
    </section>
  );
}

function DomainRadarChart({ domains }: { domains: PerformanceDomainMetric[] }) {
  const size = 260;
  const center = size / 2;
  const radius = 92;
  const angleStep = (Math.PI * 2) / domains.length;
  const levels = [20, 40, 60, 80, 100];

  const points = domains
    .map((domain, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      const r = (domain.score / 100) * radius;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="flex justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Performance domains radar">
        {levels.map((level) => {
          const r = (level / 100) * radius;
          const poly = domains
            .map((_, index) => {
              const angle = -Math.PI / 2 + index * angleStep;
              const x = center + Math.cos(angle) * r;
              const y = center + Math.sin(angle) * r;
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ");
          return <polygon key={level} points={poly} fill="none" stroke="rgb(226 232 240)" strokeWidth="1" />;
        })}

        {domains.map((domain, index) => {
          const angle = -Math.PI / 2 + index * angleStep;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          const tx = center + Math.cos(angle) * (radius + 16);
          const ty = center + Math.sin(angle) * (radius + 16);
          return (
            <g key={domain.code}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="rgb(226 232 240)" strokeWidth="1" />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="rgb(71 85 105)" fontWeight="700">
                {domain.code}
              </text>
            </g>
          );
        })}

        <polygon points={points} fill="rgba(6, 182, 212, 0.20)" stroke="rgb(8 145 178)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function DomainScoreCard({ domain }: { domain: PerformanceDomainMetric }) {
  const trendPositive = domain.trendDelta >= 0;
  const trendLabel = `${trendPositive ? "+" : ""}${domain.trendDelta}`;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {domain.code} - {domain.label}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${trendPositive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
          {trendLabel}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{domain.score}</p>
      <p className="text-xs text-slate-600">Percentile: {domain.percentile}th</p>
      <p className="text-xs text-slate-500">Platform avg: {domain.platformAverage}</p>
    </article>
  );
}

export function DoctorPerformanceDomains() {
  const domains = getPerformanceDomains();
  const weakest = [...domains].sort((a, b) => a.score - b.score)[0];
  const recModule = trainingModulesDemo.find((module) => module.domain === weakest.trainingDomain) ?? null;

  return (
    <section className={cardClassName("border-cyan-100 bg-gradient-to-br from-white via-cyan-50/25 to-white")}>
      <SectionTitle
        title="Performance Domains"
        subtitle="Five-core domain performance to reinforce improvement, consistency, and credibility."
      />
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <DomainRadarChart domains={domains} />
        </section>
        <section>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {domains.map((domain) => (
              <DomainScoreCard key={domain.code} domain={domain} />
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <article className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Weakest domain highlight</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {weakest.code} - {weakest.label}
              </p>
              <p className="text-xs text-slate-700">
                Score {weakest.score}, currently {weakest.percentile}th percentile. Prioritize this to improve consistency and visibility readiness.
              </p>
            </article>
            <article className="rounded-xl border border-violet-200 bg-violet-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Recommended training module</p>
              {recModule ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{recModule.title}</p>
                  <p className="text-xs text-slate-700">
                    {recModule.level} - {recModule.estMinutes} min
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-slate-700">No direct module mapped yet for this domain.</p>
              )}
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}

function buildLinePath(
  points: Array<{ x: number; y: number }>
) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

export function DoctorPerformanceTimeline() {
  const [procedureFilter, setProcedureFilter] = useState("ALL");
  const [clinicFilter, setClinicFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");

  const filtered = useMemo(() => {
    const now = new Date("2026-03-14");
    const points = doctorPerformanceTimelineDemo.filter((point) => {
      if (procedureFilter !== "ALL" && point.procedureType !== procedureFilter) return false;
      if (clinicFilter !== "ALL" && point.clinic !== clinicFilter) return false;
      if (dateRange !== "ALL") {
        const d = new Date(point.submittedAt);
        const months = dateRange === "6M" ? 6 : dateRange === "12M" ? 12 : 999;
        const threshold = new Date(now);
        threshold.setMonth(threshold.getMonth() - months);
        if (d < threshold) return false;
      }
      return true;
    });
    return [...points].sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  }, [procedureFilter, clinicFilter, dateRange]);

  const width = 760;
  const height = 280;
  const padding = 36;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const domainColor: Record<PerformanceDomainCode, string> = {
    SP: "#0891b2",
    DP: "#059669",
    GV: "#7c3aed",
    IC: "#d97706",
    DI: "#475569",
  };

  const plot = useMemo(() => {
    if (filtered.length === 0) return null;
    const n = filtered.length;
    const xStep = n <= 1 ? 0 : innerWidth / (n - 1);
    const toY = (value: number) => padding + (1 - value / 100) * innerHeight;

    const auditPoints = filtered.map((point, idx) => ({
      x: padding + idx * xStep,
      y: toY(point.auditScore),
      label: point.caseTypeLabel,
      date: point.submittedAt,
    }));
    const domainPoints = (["SP", "DP", "GV", "IC", "DI"] as PerformanceDomainCode[]).reduce(
      (acc, code) => {
        acc[code] = filtered.map((point, idx) => ({
          x: padding + idx * xStep,
          y: toY(point.domainScores[code]),
        }));
        return acc;
      },
      {} as Record<PerformanceDomainCode, Array<{ x: number; y: number }>>
    );
    return { auditPoints, domainPoints };
  }, [filtered, innerHeight, innerWidth]);

  const avgScore =
    filtered.reduce((sum, point) => sum + point.auditScore, 0) /
    Math.max(filtered.length, 1);

  return (
    <section className={cardClassName()}>
      <SectionTitle
        title="Doctor Performance Timeline"
        subtitle="Track case submissions, audit scores, and domain evolution over time."
      />
      <div className="grid gap-2 md:grid-cols-3">
        <TextSelect
          label="Procedure type"
          value={procedureFilter}
          onChange={setProcedureFilter}
          options={["ALL", ...Array.from(new Set(doctorPerformanceTimelineDemo.map((point) => point.procedureType)))]}
        />
        <TextSelect
          label="Clinic"
          value={clinicFilter}
          onChange={setClinicFilter}
          options={["ALL", ...Array.from(new Set(doctorPerformanceTimelineDemo.map((point) => point.clinic)))]}
        />
        <TextSelect
          label="Date range"
          value={dateRange}
          onChange={setDateRange}
          options={["ALL", "6M", "12M"]}
        />
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        {plot ? (
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Doctor performance timeline graph">
              {[20, 40, 60, 80, 100].map((tick) => {
                const y = padding + (1 - tick / 100) * innerHeight;
                return (
                  <g key={tick}>
                    <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                    <text x={8} y={y + 4} fontSize="10" fill="#64748b">
                      {tick}
                    </text>
                  </g>
                );
              })}

              {(Object.keys(plot.domainPoints) as PerformanceDomainCode[]).map((code) => (
                <path
                  key={code}
                  d={buildLinePath(plot.domainPoints[code])}
                  fill="none"
                  stroke={domainColor[code]}
                  strokeWidth="1.8"
                  opacity="0.85"
                />
              ))}

              <path d={buildLinePath(plot.auditPoints)} fill="none" stroke="#0f172a" strokeWidth="2.8" />
              {plot.auditPoints.map((point, idx) => (
                <g key={idx}>
                  <circle cx={point.x} cy={point.y} r={3.2} fill="#0f172a" />
                  <text x={point.x} y={height - 10} textAnchor="middle" fontSize="10" fill="#475569">
                    {new Date(point.date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
            No timeline data for current filters.
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
          Avg audit score: {Math.round(avgScore)}%
        </span>
        {(Object.keys(domainColor) as PerformanceDomainCode[]).map((code) => (
          <span key={code} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: domainColor[code] }} />
            {code}
          </span>
        ))}
        <span className="rounded-full border border-slate-300 bg-slate-900 px-2 py-1 text-xs font-semibold text-white">Audit score line</span>
      </div>
    </section>
  );
}

export function DoctorPublicReputationPanel({ cases = doctorCasesDemo }: { cases?: DoctorCaseDemo[] }) {
  const publicCases = cases.filter((caseItem) => caseItem.visibility !== "INTERNAL");
  const publicReportCount = publicCases.length;
  const publicScoreValues = publicCases.map((caseItem) => caseItem.score).filter((score): score is number => typeof score === "number");
  const publicAverage = Math.round(
    publicScoreValues.reduce((sum, score) => sum + score, 0) / Math.max(publicScoreValues.length, 1)
  );

  // Mock metrics for commercial/discoverability motivation layer.
  const rankingPercentile = 88;
  const estimatedProfileViews = 1240;
  const discoverabilityScore = 81;

  const publishCandidates = cases.filter(
    (caseItem) => (caseItem.score ?? 0) > 85 && caseItem.visibility !== "PUBLIC_LIVE"
  );

  return (
    <section className={cardClassName("border-violet-200 bg-gradient-to-br from-white via-violet-50/35 to-white")}>
      <SectionTitle
        title="Public Reputation"
        subtitle="Translate high-quality audit outcomes into public trust and discoverability growth."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Public audit reports</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{publicReportCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Public average score</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{publicAverage}%</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ranking percentile</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{rankingPercentile}th</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated profile views</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{estimatedProfileViews.toLocaleString()}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Discoverability score</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{discoverabilityScore}</p>
        </article>
      </div>

      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
        {publishCandidates.length > 0 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Public visibility opportunity</p>
            <p className="mt-1 text-sm text-slate-800">
              <span className="font-semibold">{publishCandidates[0].title}</span> scored{" "}
              <span className="font-semibold">{publishCandidates[0].score}%</span>. Make this report public to strengthen your trust signal.
            </p>
            <div className="mt-2">
              <Link
                href="/dashboard/doctor/reports"
                className="inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Make this report public
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Visibility guidance</p>
            <p className="mt-1 text-sm text-slate-700">
              When a report exceeds 85, publish it to compound long-term credibility and discovery momentum.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export function DoctorRecentCases({ cases = doctorCasesDemo }: { cases?: DoctorCaseDemo[] }) {
  return (
    <section className={cardClassName()}>
      <SectionTitle title="Recent Cases" subtitle="Latest submissions and case-level visibility state." />
      {cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-slate-900">No cases yet</p>
          <p className="mt-1 text-xs text-slate-600">Start your first doctor case and your trend cards will populate here.</p>
          <Link href="/dashboard/doctor/upload" className="mt-3 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            Upload first case
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                  <p className="text-xs text-slate-600">
                    {c.patientReference} - {c.caseType}
                  </p>
                </div>
                <DoctorVisibilityBadge visibility={c.visibility} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function domainLabel(domain: TrainingDomain) {
  return domain.replaceAll("_", " ");
}

export function DoctorTrainingRecommendations({
  fromCases = doctorCasesDemo,
  threshold = 75,
}: {
  fromCases?: DoctorCaseDemo[];
  threshold?: number;
}) {
  const averagedScores = fromCases.reduce(
    (acc, caseItem) => {
      (Object.entries(caseItem.performanceDomainScores) as Array<[PerformanceDomainCode, number]>).forEach(
        ([code, score]) => {
          acc.totals[code] = (acc.totals[code] ?? 0) + score;
          acc.counts[code] = (acc.counts[code] ?? 0) + 1;
        }
      );
      return acc;
    },
    {
      totals: {} as Partial<Record<PerformanceDomainCode, number>>,
      counts: {} as Partial<Record<PerformanceDomainCode, number>>,
    }
  );

  const averageDomainScores = (Object.keys(DOMAIN_LABELS) as PerformanceDomainCode[]).reduce(
    (acc, code) => {
      const total = averagedScores.totals[code] ?? 0;
      const count = averagedScores.counts[code] ?? 0;
      if (count > 0) acc[code] = Math.round(total / count);
      return acc;
    },
    {} as Partial<Record<PerformanceDomainCode, number>>
  );

  const intelligence = getTrainingIntelligenceFromDomainScores(averageDomainScores, threshold);
  const modules = intelligence.recommendedModules;

  return (
    <section className={cardClassName()}>
      <SectionTitle title="Recommended Training" subtitle="Generated from domain scores below threshold and mapped to improvement modules." />
      {intelligence.weakestDomain ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Weakest domain</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {intelligence.weakestDomain} - {DOMAIN_LABELS[intelligence.weakestDomain]}
          </p>
          <p className="text-xs text-slate-700">
            Prioritize modules in this domain first to improve next-report quality trajectory.
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {modules.map((module) => (
          <article key={module.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{module.title}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {domainLabel(module.domain)} - {module.level} - {module.estMinutes} min
                </p>
              </div>
              {module.locked ? (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">Locked</span>
              ) : (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Open</span>
              )}
            </div>
            {module.premium ? <p className="mt-2 text-xs text-slate-500">Premium module - payment-ready enrollment placeholder</p> : null}
          </article>
        ))}
      </div>
      {modules.length === 0 ? (
        <p className="text-sm text-slate-700">No below-threshold domains detected. Continue consistency and consider advanced modules.</p>
      ) : null}
      <div className="mt-3">
        <Link href="/dashboard/doctor/training" className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
          Open training portal
        </Link>
      </div>
    </section>
  );
}

export function DoctorPortalHome() {
  const total = doctorCasesDemo.length;
  const completed = doctorCasesDemo.filter((c) => c.status === "COMPLETED").length;
  const inReview = doctorCasesDemo.filter((c) => c.status === "IN_REVIEW").length;
  const publicReports = doctorCasesDemo.filter((c) => c.visibility === "PUBLIC_LIVE").length;
  const internalReports = doctorCasesDemo.filter((c) => c.visibility === "INTERNAL").length;
  const avgScore = Math.round(
    doctorCasesDemo.filter((c) => typeof c.score === "number").reduce((sum, c) => sum + Number(c.score ?? 0), 0) /
      Math.max(doctorCasesDemo.filter((c) => typeof c.score === "number").length, 1)
  );
  const defaultCompletion = getDefaultProfileCompletion(defaultSurgicalProfileDemo);
  const profileReadiness = doctorProfileDemo.profileCompletion;
  const stats: KpiStat[] = [
    { label: "Total cases", value: String(total), detail: "All-time submitted or in-progress" },
    { label: "In review", value: String(inReview), detail: "Awaiting auditor finalization" },
    { label: "Completed audits", value: String(completed) },
    { label: "Public reports", value: String(publicReports) },
    { label: "Internal reports", value: String(internalReports) },
    { label: "Average score", value: `${avgScore}%`, detail: "Last 12 months" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
      <DoctorHeroSummary />
      <DoctorNeedsInputPanel />
      <section className="grid gap-3 md:grid-cols-3">
        <article className={cardClassName()}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor profile completion</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{profileReadiness}%</p>
          <p className="text-xs text-slate-600">Visibility metadata, specialties, and discoverability signals.</p>
        </article>
        <article className={cardClassName()}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Surgical default profile</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{defaultCompletion}%</p>
          <p className="text-xs text-slate-600">Applied automatically in each new upload wizard.</p>
        </article>
        <article className={cardClassName()}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Public profile readiness</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">76%</p>
          <p className="text-xs text-slate-600">Improve discoverability with public-ready cases and profile depth.</p>
        </article>
      </section>

      <section>
        <SectionTitle title="Quick Actions" subtitle="Designed for repeat use: choose one action and continue where you left off." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { href: "/dashboard/doctor/upload", label: "Upload New Case", hint: "Fast 5-step flow", icon: "upload" as const, primary: true },
            { href: "/dashboard/doctor/defaults", label: "Edit Surgical Defaults", hint: "Save once, reuse forever", icon: "defaults" as const },
            { href: "/dashboard/doctor/reports", label: "View Audit Reports", hint: "Resolve pending inputs", icon: "reports" as const },
            { href: "/dashboard/doctor/training", label: "Training Portal", hint: "Modules from weak domains", icon: "training" as const },
            { href: "/dashboard/doctor/public-profile", label: "Public Profile Settings", hint: "Boost discoverability", icon: "profile" as const },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`${cardClassName(
                `transition hover:border-cyan-300 ${
                  action.primary ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:border-slate-800" : ""
                }`
              )} block`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className={`text-sm font-semibold ${action.primary ? "text-white" : "text-slate-900"}`}>{action.label}</p>
                {action.primary ? (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 3v12m0 0l4-4m-4 4l-4-4M5 20h14" />
                    </svg>
                  </span>
                ) : (
                  <IconBubble kind={action.icon} />
                )}
              </div>
              <p className={`mt-2 text-xs ${action.primary ? "text-slate-200" : "text-slate-600"}`}>{action.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      <DoctorQuickStats stats={stats} />
      <DoctorPublicReputationPanel />
      <DoctorPerformanceDomains />
      <DoctorPerformanceTimeline />
      <section className={cardClassName("border-cyan-100 bg-gradient-to-br from-white via-cyan-50/25 to-white")}>
        <SectionTitle
          title="Clinical Intelligence Layer"
          subtitle="At-a-glance analytics focused on improvement, consistency, and public credibility."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <section className={cardClassName()}>
            <SectionTitle title="Cases Submitted Over Time" />
            <Sparkline values={casesOverTimeDemo} width={460} height={130} strokeClassName="text-emerald-600" fillClassName="text-emerald-200/40" />
          </section>
          <DoctorCaseStatusChart />
          <DoctorScoreTrendChart />
          <section className={cardClassName()}>
            <SectionTitle title="Public vs Internal Case Split" />
            <MiniBarChart data={publicVsInternalDemo} />
          </section>
          <DoctorStrengthDistribution />
          <DoctorAuditCompletionPipeline />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DoctorRecentCases />
        <DoctorTrainingRecommendations />
      </section>
      <section className={cardClassName("bg-cyan-50/50 border-cyan-100")}>
        <SectionTitle
          title="Performance Insights"
          subtitle="Clinic-style intelligence, presented in a lighter patient-style reading flow."
        />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Most improved</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Implantation precision +6 points</p>
          </div>
          <div className="rounded-xl border border-white bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs attention</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Graft handling consistency</p>
          </div>
          <div className="rounded-xl border border-white bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visibility opportunity</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">2 reports can move to public review</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DefaultProfileSummaryCard({ profile }: { profile: DoctorDefaultSurgicalProfile }) {
  const boolTag = (value: boolean) => (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        value ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {value ? "Yes" : "No"}
    </span>
  );

  const chip = (label: string) => (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{label}</span>
  );

  return (
    <section className={cardClassName()}>
      <SectionTitle title="Default Profile Summary" subtitle="This setup is auto-applied so each upload stays fast and consistent." />
      <div className="space-y-3">
        <article className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extraction setup</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {chip(profile.extraction.extractionMethod)}
            {chip(`${profile.extraction.punchType} (${profile.extraction.punchDiameter})`)}
            {chip(profile.extraction.powerMode)}
            {chip(profile.extraction.donorShavingStyle)}
          </div>
          <p className="mt-2 text-xs text-slate-600">{profile.extraction.extractionPattern}</p>
        </article>
        <article className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Holding solution</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {chip(profile.graftHolding.holdingSolution)}
            {chip(profile.graftHolding.sortingProtocol)}
            {boolTag(profile.graftHolding.chilled)}
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Implantation setup</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {chip(profile.implantation.implantationTechnique)}
            {chip(profile.implantation.implanterType)}
            {chip(profile.implantation.bladeOrSlitType)}
            {chip(profile.implantation.placementModel)}
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adjuncts</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">PRP:</span>
            {boolTag(profile.adjuncts.prpUsed)}
            <span className="text-xs text-slate-600">Exosomes:</span>
            {boolTag(profile.adjuncts.exosomesUsed)}
            <span className="text-xs text-slate-600">ATP:</span>
            {boolTag(profile.adjuncts.atpUsed)}
            {chip(profile.adjuncts.fluidBase)}
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow / team setup</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {chip(`${profile.workflow.assistantCount} assistants`)}
            {chip(profile.workflow.extractionOperator)}
            {chip(profile.workflow.implanterLoader)}
            {chip(profile.workflow.graftPlacementOperator)}
          </div>
        </article>
      </div>
    </section>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className={cardClassName()} open={title.startsWith("A.") || title.startsWith("B.")}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">{title}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}

function TextSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full p-1 transition ${checked ? "bg-cyan-600" : "bg-slate-300"}`}
      >
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </label>
  );
}

function SegmentedChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            value === opt ? "border-cyan-300 bg-cyan-50 text-cyan-800" : "border-slate-300 bg-white text-slate-700 hover:border-cyan-300"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function DoctorDefaultProfileEditor() {
  const [profile, setProfile] = useState<DoctorDefaultSurgicalProfile>(defaultSurgicalProfileDemo);
  const [savedAt, setSavedAt] = useState<string>("2026-03-12 09:18");
  const completion = getDefaultProfileCompletion(profile);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6">
      <section className={cardClassName("bg-cyan-50/60 border-cyan-200")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Default Surgical Profile</h1>
            <p className="text-sm text-slate-600">Save your standard setup once, then only override case-specific changes.</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion</p>
            <p className="text-2xl font-bold text-slate-900">{completion}%</p>
            <p className="text-xs text-slate-500">Last updated: {savedAt}</p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-cyan-100">
          <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${completion}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">Default-first workflow enabled</span>
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">Future uploads use this automatically</span>
        </div>
      </section>

      <FieldGroup title="A. Extraction defaults">
        <TextSelect
          label="Extraction method"
          value={profile.extraction.extractionMethod}
          onChange={(v) => setProfile((prev) => ({ ...prev, extraction: { ...prev.extraction, extractionMethod: v } }))}
          options={["FUE", "DHI", "FUT", "Mixed FUE/FUT"]}
        />
        <TextSelect
          label="Punch type"
          value={profile.extraction.punchType}
          onChange={(v) => setProfile((prev) => ({ ...prev, extraction: { ...prev.extraction, punchType: v } }))}
          options={["Hybrid trumpet", "Sharp", "Dull", "Serrated", "Other"]}
        />
        <TextSelect
          label="Punch diameter"
          value={profile.extraction.punchDiameter}
          onChange={(v) => setProfile((prev) => ({ ...prev, extraction: { ...prev.extraction, punchDiameter: v } }))}
          options={["0.75 mm", "0.80 mm", "0.85 mm", "0.90 mm", "1.00 mm"]}
        />
        <TextSelect
          label="Donor shaving style"
          value={profile.extraction.donorShavingStyle}
          onChange={(v) => setProfile((prev) => ({ ...prev, extraction: { ...prev.extraction, donorShavingStyle: v } }))}
          options={["Partial shave", "Full shave", "Long-hair extraction"]}
        />
      </FieldGroup>

      <FieldGroup title="B. Graft holding defaults">
        <TextSelect
          label="Holding solution"
          value={profile.graftHolding.holdingSolution}
          onChange={(v) => setProfile((prev) => ({ ...prev, graftHolding: { ...prev.graftHolding, holdingSolution: v } }))}
          options={["HypoThermosol + saline blend", "Saline", "LR", "ATP-enhanced solution", "Other"]}
        />
        <TextSelect
          label="Sorting protocol"
          value={profile.graftHolding.sortingProtocol}
          onChange={(v) => setProfile((prev) => ({ ...prev, graftHolding: { ...prev.graftHolding, sortingProtocol: v } }))}
          options={["1/2/3/4 grouped trays", "Singles separated only", "No fixed sorting", "Other"]}
        />
        <Toggle
          label="Chilled graft storage"
          checked={profile.graftHolding.chilled}
          onChange={(v) => setProfile((prev) => ({ ...prev, graftHolding: { ...prev.graftHolding, chilled: v } }))}
        />
      </FieldGroup>

      <FieldGroup title="C. Implantation defaults">
        <TextSelect
          label="Implantation technique"
          value={profile.implantation.implantationTechnique}
          onChange={(v) => setProfile((prev) => ({ ...prev, implantation: { ...prev.implantation, implantationTechnique: v } }))}
          options={["DHI-assisted FUE", "Forceps placement", "Stick and place", "Mixed"]}
        />
        <TextSelect
          label="Implanter type"
          value={profile.implantation.implanterType}
          onChange={(v) => setProfile((prev) => ({ ...prev, implantation: { ...prev.implantation, implanterType: v } }))}
          options={["Lion 0.8/0.9", "CHOI", "No implanter", "Other"]}
        />
        <Toggle
          label="Technician-assisted placement"
          checked={profile.implantation.placementModel === "technician_assisted"}
          onChange={(v) =>
            setProfile((prev) => ({
              ...prev,
              implantation: { ...prev.implantation, placementModel: v ? "technician_assisted" : "doctor_only" },
            }))
          }
        />
      </FieldGroup>

      <FieldGroup title="D. Adjunct / support defaults">
        <Toggle
          label="PRP used"
          checked={profile.adjuncts.prpUsed}
          onChange={(v) => setProfile((prev) => ({ ...prev, adjuncts: { ...prev.adjuncts, prpUsed: v } }))}
        />
        <Toggle
          label="Exosomes used"
          checked={profile.adjuncts.exosomesUsed}
          onChange={(v) => setProfile((prev) => ({ ...prev, adjuncts: { ...prev.adjuncts, exosomesUsed: v } }))}
        />
        <Toggle
          label="ATP used"
          checked={profile.adjuncts.atpUsed}
          onChange={(v) => setProfile((prev) => ({ ...prev, adjuncts: { ...prev.adjuncts, atpUsed: v } }))}
        />
      </FieldGroup>

      <FieldGroup title="E. Team / theatre workflow defaults">
        <TextSelect
          label="Number of assistants"
          value={profile.workflow.assistantCount}
          onChange={(v) => setProfile((prev) => ({ ...prev, workflow: { ...prev.workflow, assistantCount: v } }))}
          options={["1-2", "3-4", "4-6", "6+"]}
        />
        <TextSelect
          label="Who performs extraction"
          value={profile.workflow.extractionOperator}
          onChange={(v) => setProfile((prev) => ({ ...prev, workflow: { ...prev.workflow, extractionOperator: v } }))}
          options={["Doctor only", "Lead tech supervised", "Mixed", "Other"]}
        />
      </FieldGroup>

      <FieldGroup title="F. Post-op package defaults">
        <Toggle
          label="PRP aftercare included"
          checked={profile.postOp.prpAftercareIncluded}
          onChange={(v) => setProfile((prev) => ({ ...prev, postOp: { ...prev.postOp, prpAftercareIncluded: v } }))}
        />
        <TextSelect
          label="Follow-up cadence"
          value={profile.postOp.followUpCadence}
          onChange={(v) => setProfile((prev) => ({ ...prev, postOp: { ...prev.postOp, followUpCadence: v } }))}
          options={["Day 1, Day 7, Month 1, Month 6, Month 12", "Week 1, Month 1, Month 3, Month 6, Month 12", "Custom cadence"]}
        />
      </FieldGroup>

      <section className={cardClassName()}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSavedAt(new Date().toLocaleString())}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Save as my default profile
          </button>
          <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Copy to future uploads
          </button>
        </div>
      </section>
    </div>
  );
}

export function CaseOverridePanel({
  overrides,
  defaults = defaultSurgicalProfileDemo,
  onChange,
}: {
  overrides: DoctorCaseOverride;
  defaults?: DoctorDefaultSurgicalProfile;
  onChange: (value: DoctorCaseOverride) => void;
}) {
  const isMotorised = (overrides.extraction?.powerMode ?? defaults.extraction.powerMode) === "motorised";
  const placement = overrides.implantation?.placementModel ?? defaults.implantation.placementModel;
  const graftBand = overrides.workflow?.assistantCount ?? defaults.workflow.assistantCount;

  return (
    <section className={cardClassName()}>
      <SectionTitle title="Case-specific overrides" subtitle="Only adjust what changed for this case. Everything else remains from saved defaults." />
      <div className="grid gap-3 md:grid-cols-2">
        <TextSelect
          label="Punch type"
          value={overrides.extraction?.punchType ?? defaults.extraction.punchType}
          onChange={(v) => onChange({ ...overrides, extraction: { ...(overrides.extraction ?? {}), punchType: v } })}
          options={["Hybrid trumpet", "Sharp", "Dull", "Serrated", "Other"]}
        />
        <TextSelect
          label="Holding solution"
          value={overrides.graftHolding?.holdingSolution ?? defaults.graftHolding.holdingSolution}
          onChange={(v) => onChange({ ...overrides, graftHolding: { ...(overrides.graftHolding ?? {}), holdingSolution: v } })}
          options={["HypoThermosol + saline blend", "Saline", "LR", "ATP-enhanced solution", "Other"]}
        />
        <Toggle
          label="PRP used this case"
          checked={overrides.adjuncts?.prpUsed ?? defaults.adjuncts.prpUsed}
          onChange={(v) => onChange({ ...overrides, adjuncts: { ...(overrides.adjuncts ?? {}), prpUsed: v } })}
        />
        <Toggle
          label="Technician-assisted"
          checked={placement === "technician_assisted"}
          onChange={(v) =>
            onChange({
              ...overrides,
              implantation: { ...(overrides.implantation ?? {}), placementModel: v ? "technician_assisted" : "doctor_only" },
            })
          }
        />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <section className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Motor / manual</p>
          <SegmentedChips
            options={["motorised", "manual"]}
            value={isMotorised ? "motorised" : "manual"}
            onChange={(next) => onChange({ ...overrides, extraction: { ...(overrides.extraction ?? {}), powerMode: next as "manual" | "motorised" } })}
          />
        </section>
        <section className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Placement model</p>
          <SegmentedChips
            options={["doctor_only", "technician_assisted"]}
            value={placement}
            onChange={(next) =>
              onChange({
                ...overrides,
                implantation: {
                  ...(overrides.implantation ?? {}),
                  placementModel: next as "doctor_only" | "technician_assisted",
                },
              })
            }
          />
        </section>
        <section className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Assistant band</p>
          <SegmentedChips
            options={["1-2", "3-4", "4-6", "6+"]}
            value={graftBand}
            onChange={(next) => onChange({ ...overrides, workflow: { ...(overrides.workflow ?? {}), assistantCount: next } })}
          />
        </section>
      </div>
    </section>
  );
}

type EvidenceCategory = { key: string; label: string; required?: boolean };

const evidenceCategories: EvidenceCategory[] = [
  { key: "pre_front", label: "Pre-op front", required: true },
  { key: "pre_left", label: "Pre-op left", required: true },
  { key: "pre_right", label: "Pre-op right", required: true },
  { key: "pre_top", label: "Pre-op top", required: true },
  { key: "pre_crown", label: "Pre-op crown", required: true },
  { key: "donor_rear", label: "Pre-op donor rear", required: true },
  { key: "donor_lr", label: "Pre-op donor left/right", required: true },
  { key: "intra_donor", label: "Intra-op donor", required: true },
  { key: "intra_recipient", label: "Intra-op recipient", required: true },
  { key: "grafts", label: "Extracted grafts", required: true },
  { key: "placement", label: "Recipient placement", required: true },
  { key: "post_front", label: "Immediate post-op front", required: true },
  { key: "post_top", label: "Immediate post-op top", required: true },
  { key: "post_crown", label: "Immediate post-op crown", required: true },
  { key: "healed", label: "Healed follow-up", required: false },
  { key: "macro", label: "Macro close-ups", required: false },
  { key: "trichoscopy", label: "Trichoscopy", required: false },
];

export function EvidenceCompletenessMeter({
  uploadedCount,
  total,
  requiredUploaded,
  requiredTotal,
}: {
  uploadedCount: number;
  total: number;
  requiredUploaded?: number;
  requiredTotal?: number;
}) {
  const pct = Math.round((uploadedCount / Math.max(total, 1)) * 100);
  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
      <div className="flex items-center justify-between text-xs font-semibold text-cyan-900">
        <span>Evidence completeness</span>
        <span>{pct}%</span>
      </div>
      {typeof requiredUploaded === "number" && typeof requiredTotal === "number" ? (
        <p className="mt-1 text-[11px] text-cyan-900/80">
          Required views: {requiredUploaded}/{requiredTotal}
        </p>
      ) : null}
      <div className="mt-2 h-2 rounded-full bg-cyan-100">
        <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function UploadEvidenceGrid({
  uploaded,
  onToggle,
}: {
  uploaded: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const uploadedCount = Object.values(uploaded).filter(Boolean).length;
  const requiredTotal = evidenceCategories.filter((c) => c.required).length;
  const requiredUploaded = evidenceCategories.filter((c) => c.required && uploaded[c.key]).length;
  return (
    <section className={cardClassName()}>
      <SectionTitle title="Evidence Upload" subtitle="Drag/drop style tile flow optimized for fast structured capture." />
      <EvidenceCompletenessMeter
        uploadedCount={uploadedCount}
        total={evidenceCategories.length}
        requiredUploaded={requiredUploaded}
        requiredTotal={requiredTotal}
      />
      <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        Tip: complete all required tiles first, then add optional macro/trichoscopy evidence if available.
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {evidenceCategories.map((cat) => {
          const done = Boolean(uploaded[cat.key]);
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onToggle(cat.key)}
              className={`rounded-xl border p-3 text-left transition ${
                done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:border-cyan-300"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{cat.label}</p>
              <p className="text-xs text-slate-500">{cat.required ? "Required" : "Optional advanced evidence"}</p>
              <p className="mt-2 text-xs font-semibold text-slate-700">{done ? "Uploaded" : "Tap to mark uploaded"}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function CaseReadinessMeter({ readiness }: { readiness: CaseReadinessResult }) {
  const pct = readiness.percentage;
  const toneClass =
    pct >= 85
      ? "border-emerald-200 bg-emerald-50"
      : pct >= 70
        ? "border-cyan-200 bg-cyan-50"
        : "border-amber-200 bg-amber-50";
  const textTone =
    pct >= 85 ? "text-emerald-900" : pct >= 70 ? "text-cyan-900" : "text-amber-900";

  return (
    <section className={`rounded-xl border px-3 py-3 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold ${textTone}`}>Case readiness</p>
        <p className={`text-xl font-bold ${textTone}`}>{pct}%</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/70">
        <div className="h-2 rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${textTone}`}>Missing evidence</p>
          {readiness.missingEvidence.length === 0 ? (
            <p className="mt-1 text-xs text-slate-700">No critical gaps detected.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {readiness.missingEvidence.map((item) => (
                <li key={item} className="text-xs text-slate-700">
                  - {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${textTone}`}>Improve readiness</p>
          {readiness.suggestions.length === 0 ? (
            <p className="mt-1 text-xs text-slate-700">Submission is high quality and audit-ready.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {readiness.suggestions.map((item) => (
                <li key={item} className="text-xs text-slate-700">
                  - {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export function DoctorUploadWizard() {
  const [step, setStep] = useState(1);
  const [visibility, setVisibility] = useState<DoctorReportVisibility>("PUBLIC_PENDING_REVIEW");
  const [useMode, setUseMode] = useState<"saved" | "previous" | "custom">("saved");
  const [selectedPreviousCaseId, setSelectedPreviousCaseId] = useState<string>(doctorCasesDemo[0]?.id ?? "");
  const [overrides, setOverrides] = useState<DoctorCaseOverride>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});
  const [clinicLocation, setClinicLocation] = useState("Istanbul");
  const [caseCategory, setCaseCategory] = useState("Hairline");
  const [surgeryDate, setSurgeryDate] = useState("2026-03-14");
  const [patientRef, setPatientRef] = useState("HA-DR-2310");
  const selectedPreviousCase = doctorCasesDemo.find((c) => c.id === selectedPreviousCaseId) ?? null;
  const requiredTotal = evidenceCategories.filter((c) => c.required).length;
  const requiredUploaded = evidenceCategories.filter((c) => c.required && uploaded[c.key]).length;
  const effectiveMode = useMode === "custom" && !hasChanges ? "saved" : useMode;
  const selectedPreviousOverrideTemplate =
    effectiveMode === "previous" && selectedPreviousCaseId ? previousCaseOverrideTemplates[selectedPreviousCaseId] ?? null : null;
  const customOverrides = effectiveMode === "custom" ? overrides : null;
  const resolvedState = resolveCaseSettingsFromLayers({
    doctorProfile: doctorProfileDemo,
    defaults: defaultSurgicalProfileDemo,
    overrideMode: effectiveMode,
    customOverrides,
    previousCaseId: selectedPreviousCaseId,
  });
  const resolvedSettings = resolvedState.resolvedSettings;
  const submissionSnapshotPreview = createSubmissionSnapshot({
    doctorProfile: doctorProfileDemo,
    defaults: defaultSurgicalProfileDemo,
    overrideMode: effectiveMode,
    customOverrides,
    previousCaseId: selectedPreviousCaseId,
  });

  const readiness = useMemo<CaseReadinessResult>(() => {
    const totalOptional = evidenceCategories.filter((c) => !c.required).length;
    const optionalUploaded = evidenceCategories.filter((c) => !c.required && uploaded[c.key]).length;

    const metadataChecks = [
      patientRef.trim().length > 0,
      surgeryDate.trim().length > 0,
      clinicLocation.trim().length > 0,
      caseCategory.trim().length > 0,
      Boolean(visibility),
      resolvedSettings.extraction.extractionMethod.trim().length > 0,
      resolvedSettings.graftHolding.holdingSolution.trim().length > 0,
      resolvedSettings.implantation.implantationTechnique.trim().length > 0,
      resolvedSettings.workflow.assistantCount.trim().length > 0,
      resolvedSettings.postOp.followUpCadence.trim().length > 0,
    ];
    const metadataComplete =
      metadataChecks.filter(Boolean).length / Math.max(metadataChecks.length, 1);

    const donorPresenceChecks = ["donor_rear", "donor_lr", "intra_donor"];
    const donorPresence =
      donorPresenceChecks.filter((key) => Boolean(uploaded[key])).length / donorPresenceChecks.length;

    const followUpKeys = ["healed"];
    const followUpPresence = followUpKeys.some((key) => Boolean(uploaded[key])) ? 1 : 0;

    const requiredScore = requiredUploaded / Math.max(requiredTotal, 1);
    const optionalScore = optionalUploaded / Math.max(totalOptional, 1);

    const percentage = Math.round(
      100 *
        (0.5 * requiredScore +
          0.15 * optionalScore +
          0.2 * metadataComplete +
          0.1 * donorPresence +
          0.05 * followUpPresence)
    );

    const missingEvidence: string[] = [];
    for (const cat of evidenceCategories.filter((c) => c.required)) {
      if (!uploaded[cat.key]) missingEvidence.push(cat.label);
    }
    if (donorPresence < 1) {
      donorPresenceChecks
        .filter((key) => !uploaded[key])
        .forEach((key) => {
          const label = evidenceCategories.find((c) => c.key === key)?.label;
          if (label && !missingEvidence.includes(label)) missingEvidence.push(label);
        });
    }
    if (!followUpPresence) {
      missingEvidence.push("Healed follow-up");
    }

    const suggestions: string[] = [];
    if (requiredScore < 1) suggestions.push("Complete all required photo categories before submission.");
    if (donorPresence < 1) suggestions.push("Add full donor documentation set (rear, left/right, intra-op donor).");
    if (!followUpPresence) suggestions.push("Upload at least one healed follow-up image to strengthen longitudinal quality scoring.");
    if (metadataComplete < 1) suggestions.push("Fill remaining structured surgical metadata fields for more accurate audit interpretation.");
    if (optionalScore < 0.4) suggestions.push("Consider adding optional macro/trichoscopy evidence for higher confidence scoring.");

    return {
      percentage: Math.max(0, Math.min(100, percentage)),
      missingEvidence,
      suggestions,
    };
  }, [
    uploaded,
    requiredUploaded,
    requiredTotal,
    patientRef,
    surgeryDate,
    clinicLocation,
    caseCategory,
    visibility,
    resolvedSettings,
  ]);

  function stepLabel(num: number) {
    if (num === 1) return "Case basics";
    if (num === 2) return "Apply defaults";
    if (num === 3) return "Upload evidence";
    if (num === 4) return "Adjust changes";
    return "Review & submit";
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6">
      <section className={cardClassName("border-cyan-100 bg-gradient-to-br from-white via-cyan-50/40 to-emerald-50/30")}>
        <h1 className="text-xl font-semibold text-slate-900">Doctor Upload Wizard</h1>
        <p className="mt-1 text-sm text-slate-700">Fast 5-step flow: defaults first, override only what changed.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">Typical completion: 2-3 minutes</span>
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">No long-form questions required</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              type="button"
              key={num}
              onClick={() => setStep(num)}
              className={`rounded-full px-3 py-1.5 font-semibold ${
                step === num ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
              }`}
            >
              {num}. {stepLabel(num)}
            </button>
          ))}
        </div>
        <div className="mt-4 h-2 rounded-full bg-cyan-100">
          <div className="h-2 rounded-full bg-cyan-500 transition-all" style={{ width: `${(step / 5) * 100}%` }} />
        </div>
      </section>

      {step === 1 ? (
        <section className={cardClassName()}>
          <SectionTitle title="Step 1: Case Basics" />
          <div className="grid gap-3 md:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient reference</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{patientRef}</p>
                <button
                  type="button"
                  onClick={() => setPatientRef(`HA-DR-${Math.floor(2000 + Math.random() * 7000)}`)}
                  className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
                >
                  Regenerate
                </button>
              </div>
            </section>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Surgery date</span>
              <input type="date" className="w-full rounded-xl border border-slate-300 px-3 py-2" value={surgeryDate} onChange={(e) => setSurgeryDate(e.target.value)} />
            </label>
            <TextSelect label="Clinic/location" value={clinicLocation} onChange={setClinicLocation} options={["Istanbul", "London", "Madrid", "Dubai"]} />
          </div>
          <section className="mt-3 rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Case category</p>
            <SegmentedChips
              options={["First surgery", "Repair", "Hairline", "Crown", "Female", "Afro", "Diffuse", "Scar", "FUT-to-FUE"]}
              value={caseCategory}
              onChange={setCaseCategory}
            />
          </section>
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Intended visibility</p>
            <div className="grid gap-2 md:grid-cols-3">
              {VISIBILITY_OPTIONS.slice(0, 3).map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setVisibility(opt.value)}
                  className={`rounded-xl border px-3 py-2 text-left ${
                    visibility === opt.value ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                  <p className="mt-1 text-xs text-slate-600">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className={cardClassName()}>
          <SectionTitle title="Step 2: Apply Defaults" subtitle="Your saved profile makes this step instant." />
          <DefaultProfileSummaryCard profile={defaultSurgicalProfileDemo} />
          <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Time saver: 80-90% of surgical settings are already prefilled from your defaults.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setUseMode("saved")} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold">
              Use my saved defaults
            </button>
            <button type="button" onClick={() => setUseMode("previous")} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold">
              Copy from previous case
            </button>
            <button type="button" onClick={() => setUseMode("custom")} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold">
              Customise this case
            </button>
          </div>
          {useMode === "previous" ? (
            <section className="mt-3 rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Choose previous case template</p>
              <div className="grid gap-2 md:grid-cols-2">
                {doctorCasesDemo.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedPreviousCaseId(c.id)}
                    className={`rounded-xl border px-3 py-2 text-left ${
                      selectedPreviousCaseId === c.id ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-600">{c.caseType}</p>
                  </button>
                ))}
              </div>
              {selectedPreviousCase ? (
                <p className="mt-2 text-xs text-slate-600">
                  Copying defaults and patterns from: {selectedPreviousCase.title}
                </p>
              ) : null}
              {selectedPreviousOverrideTemplate ? (
                <div className="mt-2 rounded-lg border border-cyan-100 bg-cyan-50 px-2 py-2 text-xs text-cyan-900">
                  Template loaded: previous case deltas will be applied as case-level overrides.
                </div>
              ) : null}
            </section>
          ) : null}
          {useMode === "custom" ? (
            <div className="mt-3">
              <CaseOverridePanel overrides={overrides} onChange={setOverrides} />
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 3 ? <UploadEvidenceGrid uploaded={uploaded} onToggle={(key) => setUploaded((prev) => ({ ...prev, [key]: !prev[key] }))} /> : null}

      {step === 4 ? (
        <section className={cardClassName()}>
          <SectionTitle title="Step 4: Adjust Only What Changed" subtitle="Skip this if your saved setup is unchanged." />
          <div className="mb-3 rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Did anything change for this case?</p>
            <SegmentedChips options={["No changes", "Yes, adjust this case"]} value={hasChanges ? "Yes, adjust this case" : "No changes"} onChange={(next) => setHasChanges(next === "Yes, adjust this case")} />
          </div>
          {hasChanges ? (
            <CaseOverridePanel overrides={overrides} onChange={setOverrides} />
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              Defaults will be applied as-is. No extra data entry needed.
            </div>
          )}
          <details className="mt-3 rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Advanced details (optional)</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <TextSelect label="Graft count range" value="2500-3000" onChange={() => undefined} options={["<1500", "1500-2000", "2000-2500", "2500-3000", "3000+"]} />
              <TextSelect label="Session length band" value="6-8h" onChange={() => undefined} options={["<4h", "4-6h", "6-8h", "8-10h", "10h+"]} />
            </div>
          </details>
        </section>
      ) : null}

      {step === 5 ? (
        <section className={cardClassName()}>
          <SectionTitle title="Step 5: Review & Submit" />
          <div className="grid gap-3 md:grid-cols-2">
            <DefaultProfileSummaryCard profile={resolvedSettings} />
            <section className={cardClassName()}>
              <p className="text-sm font-semibold text-slate-900">Case summary</p>
              <p className="mt-1 text-xs text-slate-600">
                {patientRef} - {clinicLocation} - {caseCategory} - {surgeryDate}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Settings source:{" "}
                <span className="font-semibold text-slate-800">
                  {effectiveMode === "saved" ? "Saved defaults" : effectiveMode === "previous" ? "Copied previous case + defaults" : "Custom overrides + defaults"}
                </span>
              </p>
              <p className="text-sm font-semibold text-slate-900">Visibility mode</p>
              <div className="mt-2">
                <DoctorVisibilityBadge visibility={visibility} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">Readiness</p>
              <EvidenceCompletenessMeter
                uploadedCount={Object.values(uploaded).filter(Boolean).length}
                total={evidenceCategories.length}
                requiredUploaded={requiredUploaded}
                requiredTotal={requiredTotal}
              />
              <div className="mt-3">
                <CaseReadinessMeter readiness={readiness} />
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-1" />
                <span>I confirm this case is de-identified and accurately reflects surgical settings.</span>
              </label>
              <button type="button" className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Submit for audit
              </button>
              <p className="mt-2 text-[11px] text-slate-500">
                Snapshot ready: defaults v{submissionSnapshotPreview.defaultsVersionUsed} locked at submit. Future default edits never rewrite this case.
              </p>
            </section>
          </div>
        </section>
      ) : null}

      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
        <p className="text-xs text-slate-500">Step {step} of 5</p>
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(5, s + 1))}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {step === 5 ? "Ready to submit" : "Continue"}
        </button>
      </section>
    </div>
  );
}

export function DoctorReportsTable() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("ALL");
  const [scoreBandFilter, setScoreBandFilter] = useState<string>("ALL");
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<string, DoctorReportVisibility>>({});
  const [compareLeftId, setCompareLeftId] = useState<string>(doctorCasesDemo[0]?.id ?? "");
  const [compareRightId, setCompareRightId] = useState<string>(doctorCasesDemo[1]?.id ?? doctorCasesDemo[0]?.id ?? "");

  const resolvedVisibility = (caseId: string, fallback: DoctorReportVisibility) => visibilityOverrides[caseId] ?? fallback;

  const withResolvedVisibility = doctorCasesDemo.map((c) => ({
    ...c,
    visibilityResolved: resolvedVisibility(c.id, c.visibility),
  }));

  const scoreBadgeClass = (score: number | null) => {
    if (score === null) return "border-slate-200 bg-slate-100 text-slate-700";
    if (score >= 85) return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (score >= 75) return "border-cyan-200 bg-cyan-50 text-cyan-800";
    return "border-amber-200 bg-amber-50 text-amber-800";
  };

  const scoreBandLabel = (score: number | null) => {
    if (score === null) return "Pending";
    if (score >= 85) return "Elite";
    if (score >= 75) return "Strong";
    return "Developing";
  };

  const filtered = useMemo(() => {
    return withResolvedVisibility.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (visibilityFilter !== "ALL" && c.visibilityResolved !== visibilityFilter) return false;
      if (caseTypeFilter !== "ALL" && c.caseType !== caseTypeFilter) return false;
      if (dateFilter !== "ALL") {
        const month = c.surgeryDate.slice(0, 7);
        if (month !== dateFilter) return false;
      }
      if (scoreBandFilter !== "ALL") {
        const s = c.score ?? 0;
        if (scoreBandFilter === "80_PLUS" && s < 80) return false;
        if (scoreBandFilter === "70_79" && (s < 70 || s >= 80)) return false;
        if (scoreBandFilter === "UNDER_70" && s >= 70) return false;
      }
      return true;
    });
  }, [statusFilter, visibilityFilter, scoreBandFilter, caseTypeFilter, dateFilter, withResolvedVisibility]);

  const qualityMomentum = Math.round(
    filtered.filter((c) => typeof c.score === "number").reduce((acc, c) => acc + Number(c.score ?? 0), 0) /
      Math.max(filtered.filter((c) => typeof c.score === "number").length, 1)
  );
  const publicReadyCount = filtered.filter((c) => (c.score ?? 0) >= 80 && c.visibilityResolved !== "PUBLIC_LIVE").length;
  const weakDomainSet = new Set<TrainingDomain>(filtered.flatMap((c) => c.weakDomains));
  const trainingPriorityModules = trainingModulesDemo.filter((m) => weakDomainSet.has(m.domain)).slice(0, 4);
  const comparisonPool = filtered.length >= 2 ? filtered : withResolvedVisibility;
  const leftCase = comparisonPool.find((c) => c.id === compareLeftId) ?? comparisonPool[0] ?? null;
  const rightCase =
    comparisonPool.find((c) => c.id === compareRightId) ??
    comparisonPool.find((c) => c.id !== leftCase?.id) ??
    comparisonPool[0] ??
    null;

  const comparisonDeltas =
    leftCase && rightCase
      ? {
          auditScore: (rightCase.score ?? 0) - (leftCase.score ?? 0),
          evidenceCompleteness: rightCase.evidenceCompleteness - leftCase.evidenceCompleteness,
          surgicalMetadataCompleteness:
            rightCase.surgicalMetadataCompleteness - leftCase.surgicalMetadataCompleteness,
          domain: (Object.keys(DOMAIN_LABELS) as PerformanceDomainCode[]).reduce(
            (acc, code) => {
              acc[code] =
                (rightCase.performanceDomainScores[code] ?? 0) -
                (leftCase.performanceDomainScores[code] ?? 0);
              return acc;
            },
            {} as Record<PerformanceDomainCode, number>
          ),
        }
      : null;

  const recommendVisibility = (score: number | null): DoctorReportVisibility => {
    if (score === null) return "INTERNAL";
    if (score >= 85) return "PUBLIC_APPROVED";
    if (score >= 80) return "PUBLIC_PENDING_REVIEW";
    return "INTERNAL";
  };

  const setVisibility = (caseId: string, next: DoctorReportVisibility) => {
    setVisibilityOverrides((prev) => ({ ...prev, [caseId]: next }));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6">
      <DoctorNeedsInputPanel />
      <section className="grid gap-3 md:grid-cols-3">
        <article className={cardClassName("border-emerald-200 bg-emerald-50/70")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Quality improvement</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{qualityMomentum}%</p>
          <p className="text-xs text-slate-700">Average score across filtered reports. Use weaknesses below to lift this month-over-month.</p>
        </article>
        <article className={cardClassName("border-cyan-200 bg-cyan-50/70")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Public credibility</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{publicReadyCount}</p>
          <p className="text-xs text-slate-700">Reports currently eligible to request public visibility and build trust signals.</p>
        </article>
        <article className={cardClassName("border-violet-200 bg-violet-50/70")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Training upgrades</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{trainingPriorityModules.length}</p>
          <p className="text-xs text-slate-700">Targeted modules linked to weak scoring domains in this report set.</p>
        </article>
      </section>

      <section className={cardClassName()}>
        <SectionTitle title="Audit Reports" subtitle="Filter quickly by status, visibility, score band, and case patterns." />
        <div className="grid gap-2 md:grid-cols-3">
          <TextSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={["ALL", "DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_INPUT", "COMPLETED"]}
          />
          <TextSelect
            label="Visibility"
            value={visibilityFilter}
            onChange={setVisibilityFilter}
            options={["ALL", "INTERNAL", "PUBLIC_PENDING_REVIEW", "PUBLIC_APPROVED", "PUBLIC_LIVE"]}
          />
          <TextSelect
            label="Score band"
            value={scoreBandFilter}
            onChange={setScoreBandFilter}
            options={["ALL", "80_PLUS", "70_79", "UNDER_70"]}
          />
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowMoreFilters((prev) => !prev)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {showMoreFilters ? "Hide advanced filters" : "Show advanced filters"}
          </button>
        </div>
        {showMoreFilters ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <TextSelect
              label="Case type"
              value={caseTypeFilter}
              onChange={setCaseTypeFilter}
              options={["ALL", ...Array.from(new Set(doctorCasesDemo.map((c) => c.caseType)))]}
            />
            <TextSelect
              label="Date (month)"
              value={dateFilter}
              onChange={setDateFilter}
              options={["ALL", ...Array.from(new Set(doctorCasesDemo.map((c) => c.surgeryDate.slice(0, 7))))]}
            />
          </div>
        ) : null}
      </section>

      <section className={cardClassName("border-cyan-200 bg-cyan-50/40")}>
        <SectionTitle
          title="Case Comparison Tool"
          subtitle="Compare two historical cases side-by-side to learn what drives stronger outcomes."
        />
        <div className="grid gap-2 md:grid-cols-2">
          <TextSelect
            label="Case A"
            value={leftCase?.id ?? ""}
            onChange={setCompareLeftId}
            options={comparisonPool.map((c) => c.id)}
          />
          <TextSelect
            label="Case B"
            value={rightCase?.id ?? ""}
            onChange={setCompareRightId}
            options={comparisonPool.map((c) => c.id)}
          />
        </div>

        {leftCase && rightCase ? (
          <div className="mt-3 space-y-3">
            {comparisonDeltas ? (
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delta overview (Case B vs Case A)</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "Audit score", value: comparisonDeltas.auditScore, suffix: " pts" },
                    { label: "Evidence completeness", value: comparisonDeltas.evidenceCompleteness, suffix: "%" },
                    {
                      label: "Surgical metadata",
                      value: comparisonDeltas.surgicalMetadataCompleteness,
                      suffix: "%",
                    },
                  ].map((item) => {
                    const positive = item.value >= 0;
                    return (
                      <article key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</p>
                        <p
                          className={`text-base font-bold ${
                            positive ? "text-emerald-700" : "text-amber-800"
                          }`}
                        >
                          {positive ? "+" : ""}
                          {item.value}
                          {item.suffix}
                        </p>
                      </article>
                    );
                  })}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-5">
                  {(Object.keys(DOMAIN_LABELS) as PerformanceDomainCode[]).map((code) => {
                    const value = comparisonDeltas.domain[code];
                    const positive = value >= 0;
                    return (
                      <article key={code} className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">{code}</p>
                        <p
                          className={`text-sm font-bold ${
                            positive ? "text-emerald-700" : "text-amber-800"
                          }`}
                        >
                          {positive ? "+" : ""}
                          {value}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
            {[leftCase, rightCase].map((caseItem, idx) => (
              <article key={caseItem.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {idx === 0 ? "Case A" : "Case B"} - {caseItem.title}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {caseItem.caseType} - {caseItem.surgeryDate} - {caseItem.patientReference}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Audit score</p>
                    <p className="text-lg font-bold text-slate-900">{caseItem.score ?? "—"}%</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Evidence completeness</p>
                    <p className="text-lg font-bold text-slate-900">{caseItem.evidenceCompleteness}%</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Surgical metadata</p>
                    <p className="text-lg font-bold text-slate-900">{caseItem.surgicalMetadataCompleteness}%</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Visibility</p>
                    <p className="text-sm font-semibold text-slate-900">{(caseItem.visibilityResolved ?? caseItem.visibility).replaceAll("_", " ")}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Donor extraction pattern</p>
                  <p className="text-sm text-slate-800">{caseItem.donorExtractionPattern}</p>
                </div>
                <div className="mt-2 rounded-lg border border-slate-200 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Implantation metric</p>
                  <p className="text-sm text-slate-800">{caseItem.implantationMetric}</p>
                </div>
                <div className="mt-2 rounded-lg border border-slate-200 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Domain scores</p>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {(Object.keys(DOMAIN_LABELS) as PerformanceDomainCode[]).map((code) => (
                      <p key={code} className="text-xs text-slate-700">
                        {code} ({DOMAIN_LABELS[code]}):{" "}
                        <span className="font-semibold">{caseItem.performanceDomainScores[code] ?? "—"}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </article>
            ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
            At least two cases are required to compare.
          </div>
        )}
      </section>

      <section className={cardClassName()}>
        <SectionTitle title="Report Previews" subtitle="Visibility progression is an earned trust signal tied to report quality." />
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-slate-900">No reports match your filters</p>
            <p className="mt-1 text-xs text-slate-600">Try widening score or visibility filters to see report opportunities.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const currentVisibility = c.visibilityResolved;
              const suggested = recommendVisibility(c.score);
              const canPromote =
                (c.score ?? 0) >= 80 &&
                (currentVisibility === "INTERNAL" || currentVisibility === "PUBLIC_PENDING_REVIEW" || currentVisibility === "PUBLIC_APPROVED");

              return (
                <article key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                      <p className="text-xs text-slate-600">
                        {c.caseType} - {c.status.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreBadgeClass(c.score)}`}>
                        {c.score === null ? "Score pending" : `${c.score}% - ${scoreBandLabel(c.score)}`}
                      </span>
                      <DoctorVisibilityBadge visibility={currentVisibility} />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <section className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Strengths</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.strengthDomains.length > 0 ? (
                          c.strengthDomains.map((domain) => (
                            <span key={domain} className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-800">
                              {domainLabel(domain)}
                              {typeof c.domainScores[domain] === "number" ? ` (${c.domainScores[domain]})` : ""}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-emerald-800">Awaiting richer domain distribution.</span>
                        )}
                      </div>
                    </section>
                    <section className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Weaknesses</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.weakDomains.length > 0 ? (
                          c.weakDomains.map((domain) => (
                            <span key={domain} className="rounded-full border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-900">
                              {domainLabel(domain)}
                              {typeof c.domainScores[domain] === "number" ? ` (${c.domainScores[domain]})` : ""}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-emerald-800">No weak domains flagged in this report.</span>
                        )}
                      </div>
                    </section>
                  </div>

                  {(() => {
                    const caseTraining = getTrainingIntelligenceFromDomainScores(c.performanceDomainScores, 75);
                    if (caseTraining.recommendedModules.length === 0) return null;
                    return (
                      <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
                          Recommended training (domain-linked)
                        </p>
                        {caseTraining.weakestDomain ? (
                          <p className="mt-1 text-xs text-slate-700">
                            Weakest: {caseTraining.weakestDomain} - {DOMAIN_LABELS[caseTraining.weakestDomain]}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {caseTraining.recommendedModules.slice(0, 3).map((module) => (
                            <span key={module.id} className="rounded-full border border-violet-200 bg-white px-2 py-1 text-xs font-medium text-violet-900">
                              {module.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-700">
                      {canPromote
                        ? "This report meets visibility standards. Promote to public workflow to strengthen credibility."
                        : "Keep internal while you improve weak domains and evidence quality."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canPromote ? (
                        <button
                          type="button"
                          onClick={() => setVisibility(c.id, suggested)}
                          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Make public ({suggested.replaceAll("_", " ")})
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setVisibility(c.id, "INTERNAL")}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                      >
                        Keep internal
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={cardClassName("border-violet-200 bg-violet-50/50")}>
        <SectionTitle
          title="Recommended Training From Weak Domains"
          subtitle="Upgrade performance where it matters most, then re-submit for stronger public trust positioning."
        />
        {trainingPriorityModules.length === 0 ? (
          <p className="text-sm text-slate-700">No urgent domain weaknesses detected. You are ready to focus on advanced modules.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {trainingPriorityModules.map((module) => (
              <article key={module.id} className="rounded-xl border border-violet-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{module.title}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Domain: {domainLabel(module.domain)} - {module.level} - {module.estMinutes} min
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      module.locked ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {module.locked ? "Upgrade" : "Start"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <DoctorTrainingRecommendations fromCases={filtered} />
    </div>
  );
}

export function DoctorPublicProfileSettings() {
  const [visible, setVisible] = useState(true);
  const readiness = 76;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 sm:px-6">
      <section className={cardClassName()}>
        <h1 className="text-xl font-semibold text-slate-900">Public Profile Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage discoverability and trust signals for future public doctor ranking/search surfaces.</p>
        <div className="mt-3 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${readiness}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">Profile readiness: {readiness}%</p>
      </section>

      <section className={cardClassName()}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Profile image URL</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" defaultValue="https://example.com/doctor-profile.jpg" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Public display name</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" defaultValue="Dr. E. Kaya" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Country / city</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" defaultValue="Turkey / Istanbul" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Clinic affiliations</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" defaultValue="North Bosphorus Hair Center" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Procedures offered</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" defaultValue="FUE, DHI, Repair, Afro hair surgery" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Searchable specialties</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" defaultValue="Hairline design, donor safety, repair cases" />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Public bio</span>
          <textarea className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2" defaultValue="Hair restoration surgeon focused on donor-safe, natural-pattern results and long-term planning." />
        </label>
        <div className="mt-3">
          <Toggle label="Allow public case visibility (approved/live only)" checked={visible} onChange={setVisible} />
        </div>
        <button type="button" className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          Save public profile settings
        </button>
      </section>
    </div>
  );
}
