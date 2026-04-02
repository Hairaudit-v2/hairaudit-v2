import type { ReactNode } from "react";
import Link from "next/link";
import Sparkline from "@/components/ui/Sparkline";
import type { TraineeProgressSnapshot } from "@/lib/academy/progression";
import type { ReadinessSummary } from "@/lib/academy/competencyPhase2";
import type { LadderWithSteps } from "@/lib/academy/competency";
import type { CompetencyStepStatus } from "@/lib/academy/competencyPhase2";
import {
  TRAJECTORY_POINTS,
  buildTrackingHeadline,
  findActiveWorkStep,
  findNextUnsignedTargetStep,
  traineeStepStatusAccent,
  traineeStepStatusLabel,
  weeklyReviewDoneForWeek,
  type TraineeTrajectoryPhase,
} from "@/lib/academy/traineeDashboardModel";
import type {
  TrainingCaseAssessmentRow,
  TrainingCaseMetricsRow,
  TrainingCaseRow,
  TrainingCompetencyWeeklyReviewRow,
  TrainingDoctorRow,
  TrainingStageHistoryRow,
} from "@/lib/academy/types";
import TraineeModuleHintsClient, { type TraineeModuleHintItem } from "./TraineeModuleHintsClient";

export type TraineeDashboardModuleRec = {
  id: string;
  title: string;
  shortDescription: string;
  readOnlineUrl: string | null;
  reason: "week" | "mandatory" | "milestone";
};

export type TraineeDashboardViewProps = {
  userId: string;
  doctor: TrainingDoctorRow;
  programName: string | null;
  cohortLabel: string | null;
  siteLabel: string | null;
  competencyWeek: number | null;
  waveWindowLabel: string | null;
  snapshot: TraineeProgressSnapshot;
  trajectory: { phase: TraineeTrajectoryPhase; activeIndex: number; blurb: string };
  readinessSummary: ReadinessSummary;
  achievedStepIds: string[];
  cases: TrainingCaseRow[];
  assessments: TrainingCaseAssessmentRow[];
  metricsByCaseId: Map<string, TrainingCaseMetricsRow>;
  stageHistory: TrainingStageHistoryRow[];
  laddersWithSteps: LadderWithSteps[];
  signedTargetCount: number;
  totalTargets: number;
  suggestedStepLabels: string[];
  stepUiByStepId: Record<
    string,
    { status: CompetencyStepStatus; latestSuggestsThreshold: boolean }
  >;
  weeklyReviews: TrainingCompetencyWeeklyReviewRow[];
  reviewForWeek: TrainingCompetencyWeeklyReviewRow | null;
  weekFocusBullets: string[];
  moduleRecs: TraineeDashboardModuleRec[];
  moduleHints: TraineeModuleHintItem[];
  latestAchievementNote: string | null;
  trendTransection: number[];
  trendImplant: number[];
  trendExtract: number[];
  domainAvg: Record<string, number>;
};

function badgeClass(badge: string) {
  switch (badge) {
    case "on_track":
      return "bg-emerald-500/15 text-emerald-100 ring-emerald-400/40";
    case "needs_support":
      return "bg-rose-500/15 text-rose-100 ring-rose-400/35";
    case "ready_for_progression":
      return "bg-sky-500/15 text-sky-100 ring-sky-400/40";
    case "review_required":
      return "bg-amber-500/15 text-amber-100 ring-amber-400/40";
    default:
      return "bg-white/10 text-slate-100 ring-white/20";
  }
}

function stepAccentBar(accent: ReturnType<typeof traineeStepStatusAccent>) {
  if (accent === "ok") return "bg-emerald-500";
  if (accent === "warn") return "bg-amber-500";
  if (accent === "neutral") return "bg-sky-500";
  return "bg-slate-300";
}

function formatStageLabel(s: string) {
  return s.replace(/_/g, " ");
}

function MetricCard({
  kicker,
  value,
  sub,
  tone,
}: {
  kicker: string;
  value: ReactNode;
  sub?: string;
  tone: "slate" | "cream" | "amber" | "navy";
}) {
  const shell =
    tone === "amber"
      ? "border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-white ring-amber-100/80"
      : tone === "cream"
        ? "border-[#e8e4dc] bg-gradient-to-br from-[#faf8f4] via-white to-white ring-[#e8e4dc]/80"
        : tone === "navy"
          ? "border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 text-white ring-slate-700/60"
          : "border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-white ring-slate-100";
  const kickerCls = tone === "navy" ? "text-amber-200/90" : "text-slate-500";
  const valueCls = tone === "navy" ? "text-white" : "text-slate-900";
  const subCls = tone === "navy" ? "text-slate-300" : "text-slate-500";
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ring-1 transition-shadow hover:shadow-md ${shell}`}>
      <div className={`text-[10px] font-bold uppercase tracking-[0.12em] ${kickerCls}`}>{kicker}</div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${valueCls}`}>{value}</div>
      {sub ? <p className={`mt-1 text-xs leading-snug ${subCls}`}>{sub}</p> : null}
    </div>
  );
}

function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/80 px-4 py-6 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">{body}</p>
    </div>
  );
}

export default function TraineeDashboardView(p: TraineeDashboardViewProps) {
  const competencyHref = `/academy/trainees/${p.doctor.id}/competency`;
  const newCaseHref = `/academy/trainees/${p.doctor.id}/new-case`;

  const achievedSet = new Set(p.achievedStepIds);
  const nextTarget = findNextUnsignedTargetStep(p.laddersWithSteps, achievedSet);
  const activeWork = findActiveWorkStep(p.laddersWithSteps, p.stepUiByStepId);
  const reviewDone = weeklyReviewDoneForWeek(p.weeklyReviews, p.competencyWeek);
  const latestAssessment = p.assessments[0] ?? null;

  const trackingLine = buildTrackingHeadline({
    snapshot: p.snapshot,
    trajectoryBlurb: p.trajectory.blurb,
    readinessHeadline:
      p.readinessSummary.readinessStatus || p.readinessSummary.readinessRecordedAt
        ? p.readinessSummary.headline
        : null,
    competencyWeek: p.competencyWeek,
  });

  const progressPct =
    p.totalTargets > 0 ? Math.round((p.signedTargetCount / p.totalTargets) * 100) : p.signedTargetCount > 0 ? 100 : 0;

  const recentCases = [...p.cases].reverse().slice(0, 6);
  const recentStages = [...p.stageHistory].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()).slice(0, 6);

  const latestCaseId = p.cases.length ? p.cases[p.cases.length - 1]!.id : null;
  const latestMetrics = latestCaseId ? p.metricsByCaseId.get(latestCaseId) ?? null : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-800/80 bg-gradient-to-br from-[#0a1628] via-[#0f2744] to-[#152a45] shadow-2xl ring-1 ring-white/10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300/95">IIOHR · HairAudit Academy</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Your progression cockpit</h1>
              <p className="text-lg text-slate-200/95 font-medium">{p.doctor.full_name}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-300/90">
                {p.programName ? (
                  <span>
                    <span className="text-slate-500">Program</span> · {p.programName}
                  </span>
                ) : (
                  <span className="text-slate-500">Program · Not linked</span>
                )}
                {p.cohortLabel ? (
                  <span>
                    <span className="text-slate-500">Cohort</span> · {p.cohortLabel}
                  </span>
                ) : (
                  <span className="text-slate-500">Cohort · Not assigned</span>
                )}
                {p.siteLabel ? (
                  <span>
                    <span className="text-slate-500">Site</span> · {p.siteLabel}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <span
                className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${badgeClass(p.snapshot.badge)}`}
              >
                {p.snapshot.label}
              </span>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right backdrop-blur-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current stage</div>
                <div className="text-xl font-semibold text-white">{formatStageLabel(p.doctor.current_stage)}</div>
                {p.competencyWeek != null ? (
                  <div className="mt-1 text-xs text-amber-200/90">Competency week {p.competencyWeek} of 4</div>
                ) : (
                  <div className="mt-1 text-xs text-slate-400">Competency week · Set wave start with faculty</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/80">How you&apos;re tracking</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-100/95">{trackingLine}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Milestone coverage</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-semibold text-white tabular-nums">{progressPct}%</span>
                <span className="pb-1 text-xs text-slate-400">
                  {p.signedTargetCount}/{p.totalTargets || "—"} targets signed
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200 transition-all duration-500"
                  style={{ width: `${Math.min(100, progressPct)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <Link
              href={competencyHref}
              className="inline-flex items-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-900/20 hover:bg-amber-300 transition-colors"
            >
              Competency milestones
            </Link>
            <Link
              href="/academy/training-modules"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Training library
            </Link>
            <Link
              href={newCaseHref}
              className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Log a case
            </Link>
          </div>
        </div>
      </section>

      {/* Key metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          tone="slate"
          kicker="Signed-off targets"
          value={p.totalTargets > 0 ? `${p.signedTargetCount} / ${p.totalTargets}` : p.signedTargetCount > 0 ? `${p.signedTargetCount}` : "—"}
          sub={p.totalTargets === 0 ? "Ladders not configured or no target milestones." : undefined}
        />
        <MetricCard
          tone="amber"
          kicker="Active / next focus"
          value={
            p.totalTargets === 0 ? (
              "—"
            ) : activeWork ? (
              <span className="line-clamp-2 text-lg font-semibold">{activeWork.step.short_label || activeWork.step.label}</span>
            ) : nextTarget ? (
              <span className="line-clamp-2 text-lg font-semibold">{nextTarget.step.short_label || nextTarget.step.label}</span>
            ) : (
              "All targets signed"
            )
          }
          sub={
            p.totalTargets === 0
              ? "No target milestones configured on active ladders yet."
              : activeWork
                ? `${activeWork.ladderTitle} · ${traineeStepStatusLabel(activeWork.status)}`
                : nextTarget
                  ? `${nextTarget.ladderTitle} · next milestone`
                  : "Faculty have signed all target milestones in view."
          }
        />
        <MetricCard tone="cream" kicker="Cases logged" value={p.cases.length} sub="Chronological surgical training cases." />
        <MetricCard
          tone="slate"
          kicker="Weekly faculty review"
          value={p.competencyWeek == null ? "—" : reviewDone ? "Complete" : "Due"}
          sub={
            p.competencyWeek == null
              ? "Wave anchor not set — ask faculty to confirm start date."
              : reviewDone
                ? `Week ${p.competencyWeek} review on file.`
                : `Week ${p.competencyWeek} review not logged yet.`
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          tone="navy"
          kicker="Training modules (library)"
          value="Self-study"
          sub="Mark modules read in the library — progress syncs per device."
        />
        <MetricCard
          tone="slate"
          kicker="Cases with metrics"
          value={p.snapshot.casesWithMetrics}
          sub="Richer charts unlock as metrics are captured on cases."
        />
        <MetricCard
          tone="amber"
          kicker="Trajectory framing"
          value={TRAJECTORY_POINTS[p.trajectory.activeIndex]?.label ?? "—"}
          sub="Informational only — not a certificate."
        />
      </section>

      {/* Week focus + modules */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800/90">Current week focus</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                {p.competencyWeek != null ? `Week ${p.competencyWeek} priorities` : "Programme cadence"}
              </h2>
            </div>
            {p.waveWindowLabel ? (
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {p.waveWindowLabel}
              </span>
            ) : null}
          </div>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
            {p.weekFocusBullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold text-slate-800">Actionable next steps</p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
              {!reviewDone && p.competencyWeek != null ? (
                <li>· Confirm your week {p.competencyWeek} review with faculty.</li>
              ) : null}
              {p.cases.length === 0 ? <li>· Log your first training case with complete operative details.</li> : null}
              {p.snapshot.lastReviewReadyToProgress === false && latestAssessment ? (
                <li>· Address focus areas from your latest case assessment before the next case.</li>
              ) : null}
              <li>
                · Keep the{" "}
                <Link href={competencyHref} className="font-medium text-amber-900 underline hover:no-underline">
                  competency board
                </Link>{" "}
                updated with evidence cases your trainer can sign off.
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-900/80">Recommended modules</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Training library</h2>
          <div className="mt-4 space-y-4">
            {["week", "mandatory", "milestone"].map((reason) => {
              const label =
                reason === "week" ? "Recommended now" : reason === "mandatory" ? "Mandatory / assigned" : "Related to milestones";
              const items = p.moduleRecs.filter((m) => m.reason === reason).slice(0, 4);
              return (
                <div key={reason}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  {items.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-400">Nothing flagged yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {items.map((m, idx) => (
                        <li key={`${m.id}-${reason}-${idx}`}>
                          {m.readOnlineUrl ? (
                            <Link
                              href={m.readOnlineUrl}
                              className="text-sm font-medium text-amber-900 hover:underline"
                            >
                              {m.title}
                            </Link>
                          ) : (
                            <Link
                              href="/academy/training-modules"
                              className="text-sm font-medium text-amber-900 hover:underline"
                            >
                              {m.title}
                            </Link>
                          )}
                          <p className="text-xs text-slate-500 line-clamp-2">{m.shortDescription}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <TraineeModuleHintsClient userId={p.userId} modules={p.moduleHints} />
          </div>
        </div>
      </section>

      {/* Competency */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Competency architecture</p>
            <h2 className="text-xl font-semibold text-slate-900">Milestone board (read-only)</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              States reflect documented observations and trainer workflow. Only faculty sign-off moves a milestone to achieved.
            </p>
          </div>
          <Link href={competencyHref} className="text-sm font-semibold text-amber-800 hover:underline">
            Open full competency view →
          </Link>
        </div>

        {p.laddersWithSteps.length === 0 ? (
          <EmptyBlock
            title="Competency ladders not configured"
            body="When migrations are applied, your milestone ladders will appear here. Faculty can still log cases and assessments."
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {p.laddersWithSteps.map((ladder) => {
              const steps = [...ladder.steps].sort((a, b) => a.step_index - b.step_index).slice(0, 10);
              return (
                <div
                  key={ladder.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{ladder.title}</h3>
                      {ladder.description ? <p className="mt-1 text-xs text-slate-500 line-clamp-2">{ladder.description}</p> : null}
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {steps.map((s) => {
                      const ui = p.stepUiByStepId[s.id];
                      const status = ui?.status ?? "not_started";
                      const accent = traineeStepStatusAccent(status);
                      return (
                        <li
                          key={s.id}
                          className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                        >
                          <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${stepAccentBar(accent)}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-slate-800">{s.short_label || s.label}</span>
                              {s.is_target ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                                  Target
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500">{traineeStepStatusLabel(status)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {ladder.steps.length > steps.length ? (
                    <p className="mt-3 text-xs text-slate-400">+{ladder.steps.length - steps.length} more steps on full board</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {p.suggestedStepLabels.length > 0 ? (
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 p-4">
            <p className="text-xs font-semibold text-sky-950">Suggested from recent case metrics</p>
            <p className="mt-1 text-xs text-sky-900/80">
              Latest metrics align with criteria for: {p.suggestedStepLabels.join(" · ")}. Faculty still confirm repeatability and
              sign-off.
            </p>
          </div>
        ) : null}
      </section>

      {/* Readiness trajectory (after milestone context) */}
      <section className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-[#faf8f4] to-white p-6 shadow-sm ring-1 ring-[#e8e4dc]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Readiness trajectory</p>
            <h2 className="text-lg font-semibold text-slate-900">Trainee-facing progress framing</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-600">
              This rail summarises how your documented work and reviews are trending. Formal readiness remains recorded by faculty —
              it is not awarded on this screen.
            </p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TRAJECTORY_POINTS.map((pt, i) => {
            const active = i === p.trajectory.activeIndex;
            const past = i < p.trajectory.activeIndex;
            return (
              <div
                key={pt.key}
                className={`rounded-xl border px-3 py-3 transition-shadow ${
                  active
                    ? "border-slate-800 bg-slate-900 text-white shadow-lg ring-2 ring-amber-400/50"
                    : past
                      ? "border-emerald-200 bg-emerald-50/80 text-slate-800"
                      : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      active ? "bg-amber-400 text-slate-950" : past ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <p className={`text-[11px] font-semibold leading-tight ${active ? "text-white" : "text-slate-800"}`}>{pt.label}</p>
                </div>
                <p className={`mt-2 text-[10px] leading-snug ${active ? "text-slate-200" : "text-slate-500"}`}>{pt.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trainer feedback */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 via-white to-white p-6 shadow-sm ring-1 ring-amber-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-900/80">Recent weekly review</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Faculty narrative</h2>
          {p.reviewForWeek ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Week {p.reviewForWeek.week_number}</p>
                <p className="text-xs text-slate-500">
                  {p.reviewForWeek.review_start_date} → {p.reviewForWeek.review_end_date}
                </p>
              </div>
              <FeedbackBlock label="Strengths" text={p.reviewForWeek.strengths} />
              <FeedbackBlock label="Focus areas" text={p.reviewForWeek.focus_areas} />
              <FeedbackBlock label="Risks or concerns" text={p.reviewForWeek.risks_or_concerns} />
              <FeedbackBlock label="Recommended next targets" text={p.reviewForWeek.recommended_next_targets} />
            </div>
          ) : (
            <EmptyBlock
              title="No weekly review for this window yet"
              body="Faculty publish structured week reviews as the programme advances. You will see strengths, focus areas, and risks here."
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Latest case assessment</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Operative review notes</h2>
          {latestAssessment ? (
            <div className="mt-4 space-y-4 text-sm">
              <p className="text-xs text-slate-500">
                {latestAssessment.created_at ? new Date(latestAssessment.created_at).toLocaleDateString() : "—"} · Stage{" "}
                {formatStageLabel(latestAssessment.stage_at_assessment)}
                {latestAssessment.ready_to_progress ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                    Ready to progress
                  </span>
                ) : null}
              </p>
              <FeedbackBlock label="Strengths" text={latestAssessment.strengths} />
              <FeedbackBlock label="Development areas" text={latestAssessment.weaknesses} />
              <FeedbackBlock label="Corrective actions" text={latestAssessment.corrective_actions} />
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                Overall score:{" "}
                <span className="font-semibold text-slate-900">
                  {latestAssessment.overall_score != null ? latestAssessment.overall_score : "—"}
                </span>
                {latestAssessment.signed_off_at ? (
                  <span className="text-slate-500"> · Signed off {new Date(latestAssessment.signed_off_at).toLocaleDateString()}</span>
                ) : (
                  <span className="text-amber-700"> · Sign-off pending</span>
                )}
              </div>
            </div>
          ) : (
            <EmptyBlock
              title="No assessments yet"
              body="When faculty complete an assessment on your cases, structured strengths and focus notes will appear here."
            />
          )}
          {p.latestAchievementNote ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-800">Latest sign-off note</p>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{p.latestAchievementNote}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Cases + metrics + trends */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Operative activity</p>
            <h2 className="text-lg font-semibold text-slate-900">Cases & progression</h2>
          </div>
          <Link href={newCaseHref} className="text-sm font-semibold text-amber-800 hover:underline">
            Log new case →
          </Link>
        </div>

        {latestMetrics ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Latest transection (est.)</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {latestMetrics.transection_rate != null ? `${latestMetrics.transection_rate}%` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Implantation throughput</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {latestMetrics.implantation_grafts_per_hour != null ? `${latestMetrics.implantation_grafts_per_hour} / hr` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Extraction throughput</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {latestMetrics.extraction_grafts_per_hour != null ? `${latestMetrics.extraction_grafts_per_hour} / hr` : "—"}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No case metrics captured yet — metrics appear after faculty documentation.</p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent cases</h3>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {recentCases.length === 0 ? (
                <li className="p-4 text-sm text-slate-500">No cases yet.</li>
              ) : (
                recentCases.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <Link href={`/academy/cases/${c.id}`} className="font-medium text-amber-900 hover:underline">
                      {c.surgery_date} · {c.procedure_type || "FUE"}
                    </Link>
                    <span className="shrink-0 text-xs capitalize text-slate-500">{formatStageLabel(c.status)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage history</h3>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {recentStages.length === 0 ? (
                <li className="p-4 text-sm text-slate-500">No stage changes recorded yet.</li>
              ) : (
                recentStages.map((h) => (
                  <li key={h.id} className="p-3 text-sm">
                    <div className="font-medium text-slate-800">
                      {h.from_stage ? `${formatStageLabel(h.from_stage)} → ` : ""}
                      {formatStageLabel(h.to_stage)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {h.changed_at ? new Date(h.changed_at).toLocaleString() : "—"}
                      {h.reason ? ` · ${h.reason}` : ""}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Performance trends</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Transection rate</div>
              <Sparkline
                values={p.trendTransection.length ? p.trendTransection : [0]}
                strokeClassName="text-rose-600"
                fillClassName="text-rose-200/40"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Implantation grafts/hr</div>
              <Sparkline
                values={p.trendImplant.length ? p.trendImplant : [0]}
                strokeClassName="text-sky-600"
                fillClassName="text-sky-200/40"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Extraction grafts/hr</div>
              <Sparkline
                values={p.trendExtract.length ? p.trendExtract : [0]}
                strokeClassName="text-amber-600"
                fillClassName="text-amber-200/40"
              />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Domain summary (recent reviews)</h3>
          {Object.keys(p.domainAvg).length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No scored domains yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {Object.entries(p.domainAvg).map(([k, v]) => (
                <li key={k} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 text-slate-600 truncate" title={k}>
                    {k.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, (v / 5) * 100)}%` }} />
                  </div>
                  <span className="w-8 text-right text-slate-800 tabular-nums">{v}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {p.snapshot.hints.length > 0 ? (
        <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
          <p className="text-xs font-semibold text-sky-950">Faculty workflow hints</p>
          <ul className="mt-2 list-disc list-inside text-sm text-sky-950/90 space-y-1">
            {p.snapshot.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FeedbackBlock({ label, text }: { label: string; text: string | null }) {
  if (!text?.trim()) {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
        <p className="mt-1 text-sm text-slate-400">Not captured for this entry.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{text.trim()}</p>
    </div>
  );
}
