"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  PERFORMANCE_DEMONSTRATION_LABELS,
  type LadderWithSteps,
  buildFourWeekOverview,
  competencyWeekDateWindow,
  competencyWaveAnchor,
  isStepUnlockedForSignoff,
} from "@/lib/academy/competency";
import type { CompetencyStepStatus, ReadinessSummary, StepUiModel } from "@/lib/academy/competencyPhase2";
import type {
  PerformanceDemonstration,
  TrainingCaseRow,
  TrainingCompetencyAchievementRow,
  TrainingCompetencyStepObservationRow,
  TrainingCompetencyStepRow,
  TrainingCompetencyWeeklyReviewRow,
  TrainingDoctorRow,
} from "@/lib/academy/types";

type Props = {
  doctorId: string;
  doctor: TrainingDoctorRow & { competency_restrictions_json: Record<string, unknown> };
  laddersWithSteps: LadderWithSteps[];
  achievements: TrainingCompetencyAchievementRow[];
  stepUiByStepId: Record<string, StepUiModel>;
  observations: TrainingCompetencyStepObservationRow[];
  weeklyReviews: TrainingCompetencyWeeklyReviewRow[];
  cases: Pick<TrainingCaseRow, "id" | "surgery_date">[];
  suggestedStepIds: string[];
  trainerNames: Record<string, string>;
  isStaff: boolean;
  readinessSummary: ReadinessSummary;
  waveStartIso: string | null;
  /** Latest training case that has saved metrics — pre-fills evidence to avoid re-typing. */
  defaultEvidenceCaseId: string | null;
  caseIdsWithMetrics: string[];
};

function statusBadgeClass(status: CompetencyStepStatus): string {
  switch (status) {
    case "signed_off":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
    case "waived_optional":
      return "bg-violet-100 text-violet-900 ring-violet-200";
    case "awaiting_signoff":
      return "bg-sky-100 text-sky-900 ring-sky-200";
    case "threshold_reached":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "in_progress":
      return "bg-blue-50 text-blue-900 ring-blue-200";
    case "needs_repeat":
      return "bg-rose-100 text-rose-900 ring-rose-200";
    case "regressed":
      return "bg-red-100 text-red-900 ring-red-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function formatStatusLabel(status: CompetencyStepStatus): string {
  return status.replace(/_/g, " ");
}

function coreProgress(steps: LadderWithSteps["steps"], achieved: Set<string>) {
  const core = steps.filter((s) => !s.is_optional);
  const done = core.filter((s) => achieved.has(s.id)).length;
  const total = core.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

const SIGNOFF_NOTE_CHIPS = [
  "Met standard in supervised session",
  "Safe to progress",
  "Key segments supervised throughout",
  "Minor technique tweaks only",
  "Repeat next case for consistency",
] as const;

const READINESS_NOTE_CHIPS = [
  "Supervision level as documented",
  "Limitations noted in restrictions",
  "Further scheduled reps recommended",
] as const;

const WEEKLY_STRENGTH_CHIPS = ["Good pace", "Safe technique", "Strong communication", "Takes feedback well", "No concerns"] as const;
const WEEKLY_FOCUS_CHIPS = ["Speed", "Angles / direction", "Donor management", "Transection", "Consistency", "Workflow"] as const;
const WEEKLY_RISK_CHIPS = ["None noted", "Fatigue", "Technique drift", "Time pressure"] as const;
const WEEKLY_NEXT_CHIPS = ["Continue current targets", "Extra donor reps", "Implantation focus", "Review transection"] as const;

type FocusItem = {
  stepId: string;
  ladderTitle: string;
  step: TrainingCompetencyStepRow;
  ui: StepUiModel | undefined;
  priority: number;
};

function buildFocusItems(
  laddersWithSteps: LadderWithSteps[],
  achievedIds: Set<string>,
  stepUiByStepId: Record<string, StepUiModel>,
  suggestedSet: Set<string>
): FocusItem[] {
  const items: FocusItem[] = [];
  for (const ladder of laddersWithSteps) {
    for (const step of ladder.steps) {
      if (achievedIds.has(step.id)) continue;
      if (!isStepUnlockedForSignoff(ladder.steps, achievedIds, step.id)) continue;
      const ui = stepUiByStepId[step.id];
      const suggested = suggestedSet.has(step.id);
      let p = 5;
      const st = ui?.status;
      if (st === "awaiting_signoff") p += 100;
      else if (st === "threshold_reached") p += 72;
      else if (st === "needs_repeat" || st === "regressed") p += 58;
      else if (st === "in_progress") p += 42;
      else p += 18;
      if (suggested) p += 26;
      if (step.is_target) p += 8;
      if (ui?.repeatability.satisfied) p += 14;
      items.push({ stepId: step.id, ladderTitle: ladder.title, step, ui, priority: p });
    }
  }
  items.sort((a, b) => b.priority - a.priority);
  return items.slice(0, 10);
}

function appendChip(text: string, chip: string): string {
  const t = text.trim();
  if (!t) return chip;
  if (t.includes(chip)) return t;
  return `${t} · ${chip}`;
}

export default function CompetencyDashboardClient({
  doctorId,
  doctor,
  laddersWithSteps,
  achievements,
  stepUiByStepId,
  observations,
  weeklyReviews,
  cases,
  suggestedStepIds,
  trainerNames,
  isStaff,
  readinessSummary,
  waveStartIso,
  defaultEvidenceCaseId,
  caseIdsWithMetrics,
}: Props) {
  const router = useRouter();
  const [waveDate, setWaveDate] = useState(doctor.competency_wave_start_date || "");
  const [waveBusy, setWaveBusy] = useState(false);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const [readinessStatus, setReadinessStatus] = useState(doctor.competency_final_readiness_status || "");
  const [readinessNotes, setReadinessNotes] = useState(doctor.competency_final_readiness_notes || "");
  const [restrictionsText, setRestrictionsText] = useState(
    () => JSON.stringify(doctor.competency_restrictions_json || {}, null, 2)
  );

  const achievedByStep = useMemo(() => {
    const m = new Map<string, TrainingCompetencyAchievementRow>();
    for (const a of achievements) m.set(a.step_id, a);
    return m;
  }, [achievements]);

  const achievedIds = useMemo(() => new Set(achievements.map((a) => a.step_id)), [achievements]);
  const suggestedSet = useMemo(() => new Set(suggestedStepIds), [suggestedStepIds]);

  const obsByStep = useMemo(() => {
    const m = new Map<string, TrainingCompetencyStepObservationRow[]>();
    for (const o of observations) {
      const list = m.get(o.step_id) ?? [];
      list.push(o);
      m.set(o.step_id, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return m;
  }, [observations]);

  const waveStart = waveStartIso ? new Date(waveStartIso) : competencyWaveAnchor(doctor);
  const weeks = buildFourWeekOverview({
    waveStart,
    cases,
    achievements,
  });

  const reviewByWeek = useMemo(() => {
    const m = new Map<number, TrainingCompetencyWeeklyReviewRow>();
    for (const r of weeklyReviews) m.set(r.week_number, r);
    return m;
  }, [weeklyReviews]);

  const metricsCaseSet = useMemo(() => new Set(caseIdsWithMetrics), [caseIdsWithMetrics]);

  const focusItems = useMemo(
    () => buildFocusItems(laddersWithSteps, achievedIds, stepUiByStepId, suggestedSet),
    [laddersWithSteps, achievedIds, stepUiByStepId, suggestedSet]
  );

  const focusStepIds = useMemo(() => new Set(focusItems.map((f) => f.stepId)), [focusItems]);

  const orderedLadders = useMemo(() => {
    return [...laddersWithSteps].sort((a, b) => {
      const aHi = a.steps.some((s) => focusStepIds.has(s.id));
      const bHi = b.steps.some((s) => focusStepIds.has(s.id));
      if (aHi !== bHi) return aHi ? -1 : 1;
      return a.sort_order - b.sort_order;
    });
  }, [laddersWithSteps, focusStepIds]);

  async function saveWaveStart() {
    setWaveBusy(true);
    try {
      const res = await fetch(`/api/academy/trainees/${doctorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competency_wave_start_date: waveDate.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setWaveBusy(false);
    }
  }

  async function submitReadiness(clear: boolean) {
    setReadinessBusy(true);
    try {
      let restrictions: Record<string, unknown> | undefined;
      if (!clear && restrictionsText.trim()) {
        try {
          restrictions = JSON.parse(restrictionsText) as Record<string, unknown>;
        } catch {
          throw new Error("Restrictions must be valid JSON");
        }
      }
      const res = await fetch(`/api/academy/trainees/${doctorId}/competency/readiness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          clear
            ? { clear: true }
            : {
                status: readinessStatus || null,
                notes: readinessNotes || null,
                restrictions: restrictions ?? {},
              }
        ),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setReadinessBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8 pb-16">
      <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-slate-50 px-5 py-4 shadow-sm">
        <Link href={`/academy/trainees/${doctorId}`} className="text-sm font-medium text-amber-700 hover:underline">
          ← {doctor.full_name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Competency</h1>
        <p className="mt-1 text-sm text-slate-700">Trainer-verified milestones. Case metrics attach automatically — no need to re-type.</p>
      </div>

      {isStaff && focusItems.length > 0 ? (
        <section className="rounded-xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Current priority</h2>
          <p className="text-xs text-slate-600 mt-1">
            Next steps and metric-suggested thresholds. One tap to scroll — sign-off uses your latest case with metrics by default.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {focusItems.map((f) => (
              <a
                key={f.stepId}
                href={`#competency-step-${f.stepId}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-100/70"
              >
                <span className="text-slate-500 truncate">{f.ladderTitle}</span>
                <span className="truncate">{f.step.short_label || f.step.label}</span>
                {suggestedSet.has(f.stepId) ? <span className="shrink-0 text-[10px] font-bold text-sky-700">METRICS</span> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <details className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/70 to-white text-sm shadow-sm">
        <summary className="cursor-pointer px-4 py-3 font-medium text-slate-800">Program setup &amp; week overview</summary>
        <div className="border-t border-slate-100 px-4 py-3 space-y-4 text-xs text-slate-600">
          <p>
            Repeatability defaults on targets; single-session override is explicit. Wave start drives week boundaries for reviews.
          </p>
          {isStaff ? (
            <div className="flex flex-wrap items-end gap-2">
              <span className="text-slate-600">Wave start</span>
              <input
                type="date"
                value={waveDate}
                onChange={(e) => setWaveDate(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={waveBusy}
                onClick={() => void saveWaveStart()}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {waveBusy ? "Saving…" : "Save"}
              </button>
            </div>
          ) : null}
          {!waveStart ? (
            <p className="text-slate-500">No wave start — trainers can set one above.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-4">
              {weeks.map((w) => (
                <div key={w.weekIndex} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                  <div className="font-semibold text-slate-800">{w.label}</div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    {w.caseCount} cases · {w.achievementCount} sign-offs
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <details className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/50 to-white text-sm shadow-sm open:shadow-md">
        <summary className="cursor-pointer px-4 py-3 font-medium text-slate-800">
          Weekly reviews (quick) {waveStart ? "" : "— set wave start first"}
        </summary>
        <div className="border-t border-slate-100 px-4 py-3">
          {waveStart ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((wn) => (
                <WeeklyReviewCard
                  key={reviewByWeek.get(wn)?.id ?? `week-${wn}`}
                  doctorId={doctorId}
                  weekNumber={wn}
                  waveStart={waveStart}
                  existing={reviewByWeek.get(wn) ?? null}
                  trainerNames={trainerNames}
                  isStaff={isStaff}
                  onDone={() => router.refresh()}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Set wave start under Program setup.</p>
          )}
        </div>
      </details>

      <div className="space-y-10">
        {orderedLadders.map((ladder) => {
          const { done, total, pct } = coreProgress(ladder.steps, achievedIds);
          const achievedInLadder = ladder.steps.filter((s) => achievedIds.has(s.id));
          const currentStep =
            achievedInLadder.length === 0
              ? null
              : achievedInLadder.reduce((a, b) => (a.step_index >= b.step_index ? a : b));

          return (
            <section key={ladder.id} className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/40 p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{ladder.title}</h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {currentStep ? (
                      <>
                        Now: <span className="font-medium text-slate-800">{currentStep.short_label || currentStep.label}</span>
                      </>
                    ) : (
                      "Not started"
                    )}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 tabular-nums ring-1 ring-slate-200">
                  {done}/{total} core
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
              </div>

              <ol className="space-y-3">
                {ladder.steps.map((step) => {
                  const ach = achievedByStep.get(step.id);
                  const ui = stepUiByStepId[step.id];
                  const status: CompetencyStepStatus = ui?.status ?? (ach ? "signed_off" : "not_started");
                  const unlocked = isStepUnlockedForSignoff(ladder.steps, achievedIds, step.id);
                  const suggested = suggestedSet.has(step.id) && !ach;
                  const locked = !ach && !unlocked;
                  const stepObs = obsByStep.get(step.id) ?? [];
                  const isFocus = focusStepIds.has(step.id) && !ach && !locked;

                  if (ach) {
                    return (
                      <li key={step.id} id={`competency-step-${step.id}`} className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white">
                        <details className="group">
                          <summary className="cursor-pointer list-none px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
                            <span className="font-medium text-slate-800">{step.short_label || step.label}</span>
                            <span className="text-xs font-semibold text-emerald-800">
                              ✓ {new Date(ach.achieved_at).toLocaleDateString()}
                            </span>
                          </summary>
                          <div className="border-t border-emerald-100/80 px-3 py-2 space-y-2">
                            <AchievedBlock ach={ach} trainerNames={trainerNames} caseHrefBase="/academy/cases" />
                            {isStaff ? (
                              <EditSignOffForm
                                doctorId={doctorId}
                                achievementId={ach.id}
                                isTarget={step.is_target}
                                initialComments={ach.trainer_comments}
                                initialDemo={ach.performance_demonstration}
                                initialOverride={Boolean(ach.single_session_override)}
                                onDone={() => router.refresh()}
                              />
                            ) : null}
                          </div>
                        </details>
                      </li>
                    );
                  }

                  if (locked) {
                    return (
                      <li
                        key={step.id}
                        id={`competency-step-${step.id}`}
                        className="rounded-lg border border-slate-200 bg-slate-100/70 px-3 py-2 text-xs text-slate-600"
                      >
                        <span className="font-medium text-slate-600">{step.short_label || step.label}</span> — complete earlier
                        steps first
                      </li>
                    );
                  }

                  return (
                    <li
                      key={step.id}
                      id={`competency-step-${step.id}`}
                      className={`rounded-lg border p-3 border-amber-200/90 bg-gradient-to-br from-amber-50/40 to-white ${isFocus ? "ring-2 ring-amber-400 shadow-md" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-semibold text-slate-900">{step.short_label || step.label}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusBadgeClass(status)}`}
                        >
                          {formatStatusLabel(status)}
                        </span>
                        {step.is_target ? (
                          <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-950">
                            Target
                          </span>
                        ) : null}
                        {step.is_optional ? (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                            Optional
                          </span>
                        ) : null}
                        {suggested ? (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-900">CASE METRICS OK</span>
                        ) : null}
                      </div>

                      {ui ? (
                        <p className="text-[11px] text-slate-600 mb-2">
                          Repeatability: {ui.repeatability.countingObservations}/{ui.repeatability.minSignedObservations} obs ·{" "}
                          {ui.repeatability.distinctCasesMet}/{ui.repeatability.minDistinctCases} cases
                          {ui.repeatability.requiresTrainerObservation ? " · need trainer-observed" : ""}
                        </p>
                      ) : null}

                      <details className="text-xs mb-2">
                        <summary className="cursor-pointer font-medium text-slate-600">Threshold detail &amp; warnings</summary>
                        <div className="mt-1.5 space-y-1 text-slate-600">
                          {status === "threshold_reached" ? (
                            <p className="text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                              Threshold may be met — still needs your sign-off when repeatability is satisfied (or explicit override
                              on targets).
                            </p>
                          ) : null}
                          {ui?.warnings.map((w, i) => (
                            <p key={i} className="text-amber-900 bg-amber-50/80 border border-amber-100 rounded px-2 py-1">
                              {w}
                            </p>
                          ))}
                        </div>
                      </details>

                      {isStaff ? (
                        <div className="space-y-2 border-t border-slate-100 pt-2">
                          <ObservationLogForm
                            key={step.id}
                            doctorId={doctorId}
                            step={step}
                            cases={cases}
                            defaultEvidenceCaseId={defaultEvidenceCaseId}
                            metricsCaseSet={metricsCaseSet}
                            onDone={() => router.refresh()}
                          />
                          <TrainerStateActions
                            doctorId={doctorId}
                            step={step}
                            currentStatus={status}
                            onDone={() => router.refresh()}
                          />
                          {stepObs.length ? (
                            <details className="text-[11px] text-slate-600">
                              <summary className="cursor-pointer font-medium text-slate-500">
                                Observation history ({stepObs.length})
                              </summary>
                              <ul className="mt-1 space-y-1 pl-1">
                                {stepObs.map((o) => (
                                  <li key={o.id} className="border-b border-slate-50 pb-1">
                                    {new Date(o.created_at).toLocaleDateString()} · thr {o.threshold_met ? "Y" : "n"} · obs{" "}
                                    {o.trainer_observed ? "Y" : "n"}
                                    {o.training_case_id ? ` · case` : ""}
                                    {o.notes ? ` — ${o.notes}` : ""}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                          <SignOffForm
                            doctorId={doctorId}
                            step={step}
                            cases={cases}
                            stepUi={ui}
                            defaultEvidenceCaseId={defaultEvidenceCaseId}
                            metricsCaseSet={metricsCaseSet}
                            onDone={() => router.refresh()}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">Awaiting trainer.</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <section
        className={`rounded-xl border p-4 shadow-sm ${
          readinessSummary.readinessStatus === "ready"
            ? "border-emerald-300 bg-gradient-to-br from-emerald-50/70 to-white"
            : "border-amber-200 bg-gradient-to-br from-amber-50/40 to-white"
        }`}
      >
        <h2 className="text-sm font-semibold text-slate-900">Final readiness</h2>
        <p className="mt-1 text-sm text-slate-700">{readinessSummary.headline}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-0.5 font-semibold ${
              readinessSummary.targetsSignedOff ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"
            }`}
          >
            Ladder targets: {readinessSummary.targetsSignedOff ? "All signed off" : "Incomplete"}
          </span>
          {readinessSummary.readinessStatus ? (
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 font-semibold text-sky-900">
              Status: {readinessSummary.readinessStatus.replace(/_/g, " ")}
            </span>
          ) : null}
          {readinessSummary.readinessRecordedAt ? (
            <span className="text-slate-500">
              Recorded {new Date(readinessSummary.readinessRecordedAt).toLocaleString()}
              {doctor.competency_final_readiness_by
                ? ` · ${trainerNames[doctor.competency_final_readiness_by] || "Trainer"}`
                : null}
            </span>
          ) : null}
        </div>
        {doctor.competency_final_readiness_notes ? (
          <p className="mt-2 text-xs text-slate-600 whitespace-pre-wrap border-t border-slate-100 pt-2">
            <span className="font-semibold text-slate-700">Rationale: </span>
            {doctor.competency_final_readiness_notes}
          </p>
        ) : null}
        {doctor.competency_restrictions_json && Object.keys(doctor.competency_restrictions_json).length > 0 ? (
          <pre className="mt-2 text-[11px] bg-slate-50 rounded-md p-2 overflow-x-auto text-slate-700">
            Restrictions: {JSON.stringify(doctor.competency_restrictions_json, null, 2)}
          </pre>
        ) : null}

        {isStaff ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap gap-2">
              {(["ready", "ready_with_limitations", "extended_training_required", "not_ready"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setReadinessStatus(v)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    readinessStatus === v ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {v.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-slate-500 w-full">Quick notes (optional)</span>
              {READINESS_NOTE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setReadinessNotes((t) => appendChip(t, chip))}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                >
                  + {chip}
                </button>
              ))}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-slate-700">Custom rationale &amp; restrictions</summary>
              <div className="mt-2 space-y-2">
                <textarea
                  value={readinessNotes}
                  onChange={(e) => setReadinessNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional — use chips above or type here"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <textarea
                  value={restrictionsText}
                  onChange={(e) => setRestrictionsText(e.target.value)}
                  rows={3}
                  className="w-full font-mono text-xs rounded-md border border-slate-300 px-2 py-1.5"
                  placeholder='Restrictions JSON e.g. {"supervision":"direct"}'
                />
              </div>
            </details>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={readinessBusy}
                onClick={() => void submitReadiness(false)}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Save readiness
              </button>
              <button
                type="button"
                disabled={readinessBusy}
                onClick={() => void submitReadiness(true)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function mergeSemicolonField(prev: string, chip: string): string {
  const p = prev.trim();
  if (!p) return chip;
  const parts = p.split(";").map((s) => s.trim());
  if (parts.includes(chip)) return p;
  return `${p}; ${chip}`;
}

function stepChecklistItems(step: TrainingCompetencyStepRow): { id: string; label: string }[] {
  const c = step.criteria_json;
  if (!c || typeof c !== "object") return [];
  const at = (c as { assessment_type?: string }).assessment_type;
  if (at !== "qualitative_checklist" && at !== "hybrid") return [];
  return (c as { checklist?: { id: string; label: string }[] }).checklist ?? [];
}

function WeeklyReviewCard({
  doctorId,
  weekNumber,
  waveStart,
  existing,
  trainerNames,
  isStaff,
  onDone,
}: {
  doctorId: string;
  weekNumber: number;
  waveStart: Date;
  existing: TrainingCompetencyWeeklyReviewRow | null;
  trainerNames: Record<string, string>;
  isStaff: boolean;
  onDone: () => void;
}) {
  const win = competencyWeekDateWindow(waveStart, weekNumber);
  const [start, setStart] = useState(existing?.review_start_date || win.start);
  const [end, setEnd] = useState(existing?.review_end_date || win.end);
  const [strengths, setStrengths] = useState(existing?.strengths || "");
  const [focus, setFocus] = useState(existing?.focus_areas || "");
  const [risks, setRisks] = useState(existing?.risks_or_concerns || "");
  const [nextT, setNextT] = useState(existing?.recommended_next_targets || "");
  const [busy, setBusy] = useState(false);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/academy/trainees/${doctorId}/competency/weekly-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber,
          reviewStartDate: start,
          reviewEndDate: end,
          strengths: strengths || null,
          focusAreas: focus || null,
          risksOrConcerns: risks || null,
          recommendedNextTargets: nextT || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      onDone();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-gradient-to-br from-sky-50/40 to-white p-3 text-sm space-y-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-800 ring-1 ring-slate-200">
          Week {weekNumber}
        </span>
        {isStaff ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-md bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "…" : "Save"}
          </button>
        ) : null}
      </div>
      {existing ? (
        <p className="text-[11px] text-slate-500">
          {new Date(existing.reviewed_at).toLocaleDateString()} · {trainerNames[existing.reviewed_by] || "Trainer"}
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">Tap chips, then Save.</p>
      )}
      {isStaff ? (
        <form onSubmit={(e) => void save(e)} className="space-y-2 text-[11px]">
          <div>
            <div className="font-medium text-slate-600 mb-1">Strengths</div>
            <div className="flex flex-wrap gap-1">
              {WEEKLY_STRENGTH_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setStrengths((t) => mergeSemicolonField(t, chip))}
                  className="rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-emerald-900 hover:bg-emerald-100"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-medium text-slate-600 mb-1">Focus</div>
            <div className="flex flex-wrap gap-1">
              {WEEKLY_FOCUS_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setFocus((t) => mergeSemicolonField(t, chip))}
                  className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-amber-950 hover:bg-amber-100"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-medium text-slate-600 mb-1">Risks</div>
            <div className="flex flex-wrap gap-1">
              {WEEKLY_RISK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setRisks((t) => mergeSemicolonField(t, chip))}
                  className="rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-rose-900 hover:bg-rose-100"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-medium text-slate-600 mb-1">Next targets</div>
            <div className="flex flex-wrap gap-1">
              {WEEKLY_NEXT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setNextT((t) => mergeSemicolonField(t, chip))}
                  className="rounded-full bg-sky-50 border border-sky-100 px-2 py-0.5 text-sky-900 hover:bg-sky-100"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>
          <details className="text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">Dates &amp; free text</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border px-1 py-1" title="Start" />
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border px-1 py-1" title="End" />
            </div>
            <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={1} placeholder="Strengths (optional edit)" className="mt-2 w-full rounded border px-2 py-1" />
            <textarea value={focus} onChange={(e) => setFocus(e.target.value)} rows={1} placeholder="Focus (optional)" className="mt-1 w-full rounded border px-2 py-1" />
            <textarea value={risks} onChange={(e) => setRisks(e.target.value)} rows={1} placeholder="Risks (optional)" className="mt-1 w-full rounded border px-2 py-1" />
            <textarea value={nextT} onChange={(e) => setNextT(e.target.value)} rows={1} placeholder="Next targets (optional)" className="mt-1 w-full rounded border px-2 py-1" />
          </details>
        </form>
      ) : existing ? (
        <div className="text-xs text-slate-700 space-y-1">
          {existing.strengths ? <p><span className="font-semibold">Strengths:</span> {existing.strengths}</p> : null}
          {existing.focus_areas ? <p><span className="font-semibold">Focus:</span> {existing.focus_areas}</p> : null}
          {existing.risks_or_concerns ? <p><span className="font-semibold">Risks:</span> {existing.risks_or_concerns}</p> : null}
          {existing.recommended_next_targets ? (
            <p><span className="font-semibold">Next targets:</span> {existing.recommended_next_targets}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Trainers will add weekly reviews here.</p>
      )}
    </div>
  );
}

function ObservationLogForm({
  doctorId,
  step,
  cases,
  defaultEvidenceCaseId,
  metricsCaseSet,
  onDone,
}: {
  doctorId: string;
  step: TrainingCompetencyStepRow;
  cases: Pick<TrainingCaseRow, "id" | "surgery_date">[];
  defaultEvidenceCaseId: string | null;
  metricsCaseSet: Set<string>;
  onDone: () => void;
}) {
  const checklistItems = stepChecklistItems(step);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState(defaultEvidenceCaseId || "");
  const [notes, setNotes] = useState("");
  const [thresholdMet, setThresholdMet] = useState(true);
  const [trainerObserved, setTrainerObserved] = useState(true);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(checklistItems.map((i) => [i.id, false])),
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const checklistJson =
        checklistItems.length > 0 ? Object.fromEntries(checklistItems.map((i) => [i.id, Boolean(checklist[i.id])])) : undefined;
      const res = await fetch(`/api/academy/trainees/${doctorId}/competency/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId: step.id,
          trainingCaseId: caseId || null,
          thresholdMet,
          trainerObserved,
          notes: notes || null,
          checklistJson,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Log failed");
      setNotes("");
      setCaseId(defaultEvidenceCaseId || "");
      setChecklist(Object.fromEntries(checklistItems.map((i) => [i.id, false])));
      onDone();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Log failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-md bg-slate-50/80 border border-slate-100 p-2 space-y-2 text-xs">
      <div className="font-semibold text-slate-800">Log observation</div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="min-w-[10rem] max-w-md flex-1 rounded border px-2 py-1 text-xs"
        >
          <option value="">— Case (optional) —</option>
          {[...cases]
            .reverse()
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.surgery_date}
                {metricsCaseSet.has(c.id) ? " · metrics" : ""}
              </option>
            ))}
        </select>
        {defaultEvidenceCaseId ? (
          <button
            type="button"
            onClick={() => setCaseId(defaultEvidenceCaseId)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Use case with metrics
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={thresholdMet} onChange={(e) => setThresholdMet(e.target.checked)} />
          Threshold met
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={trainerObserved} onChange={(e) => setTrainerObserved(e.target.checked)} />
          Trainer observed
        </label>
      </div>
      {checklistItems.length ? (
        <div>
          <div className="text-[11px] font-medium text-slate-600 mb-1">Quick checklist</div>
          <div className="flex flex-wrap gap-1">
            {checklistItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setChecklist((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  checklist[item.id] ? "border-emerald-400 bg-emerald-100 text-emerald-950" : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {checklist[item.id] ? "✓ " : ""}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <details className="text-[11px]">
        <summary className="cursor-pointer font-medium text-slate-600">Optional note</summary>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Only if needed" className="mt-1 w-full rounded border px-2 py-1" />
      </details>
      <button type="submit" disabled={busy} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
        {busy ? "Saving…" : "Add observation"}
      </button>
    </form>
  );
}

const TRAINER_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "threshold_reached", label: "Threshold reached" },
  { value: "awaiting_signoff", label: "Awaiting sign-off" },
  { value: "needs_repeat", label: "Needs repeat" },
  { value: "regressed", label: "Regressed" },
  { value: "waived_optional", label: "Waive optional" },
];

function TrainerStateActions({
  doctorId,
  step,
  currentStatus,
  onDone,
}: {
  doctorId: string;
  step: TrainingCompetencyStepRow;
  currentStatus: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(currentStatus);

  useEffect(() => {
    setSel(currentStatus);
  }, [currentStatus]);

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch(`/api/academy/trainees/${doctorId}/competency/steps/${step.id}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: sel }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const options = step.is_optional ? TRAINER_STATE_OPTIONS : TRAINER_STATE_OPTIONS.filter((o) => o.value !== "waived_optional");

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className="text-slate-600 font-medium">Step status</span>
      <select value={sel} onChange={(e) => setSel(e.target.value)} className="rounded border px-2 py-1 text-xs max-w-[12rem]">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="button" disabled={busy || sel === currentStatus} onClick={() => void apply()} className="rounded-md bg-slate-700 px-2 py-1 text-xs font-bold text-white disabled:opacity-40">
        Apply
      </button>
    </div>
  );
}

function AchievedBlock({
  ach,
  trainerNames,
  caseHrefBase,
}: {
  ach: TrainingCompetencyAchievementRow;
  trainerNames: Record<string, string>;
  caseHrefBase: string;
}) {
  const name = trainerNames[ach.signed_off_by] || "Trainer";
  const demo = PERFORMANCE_DEMONSTRATION_LABELS[ach.performance_demonstration] ?? ach.performance_demonstration;
  const cap = ach.capture_json && typeof ach.capture_json === "object" ? (ach.capture_json as Record<string, unknown>) : {};
  const snap = cap.case_metrics_snapshot as Record<string, unknown> | undefined;
  const manualKeys = Object.keys(cap).filter((k) => k !== "case_metrics_snapshot");
  return (
    <div className="text-sm text-slate-700 space-y-1">
      <div className="text-xs text-slate-500">
        Signed off {new Date(ach.achieved_at).toLocaleDateString()} · {name}
        {ach.single_session_override ? (
          <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">Single-session override</span>
        ) : null}
      </div>
      {cap.session_date ? (
        <div className="text-xs text-slate-600">
          <span className="font-medium">Session date:</span> {String(cap.session_date)}
        </div>
      ) : null}
      <div className="text-xs">
        <span className="font-medium text-slate-600">Repeatability note:</span> {demo}
      </div>
      {ach.evidence_training_case_id ? (
        <div>
          <Link
            href={`${caseHrefBase}/${ach.evidence_training_case_id}`}
            className="text-xs font-semibold text-amber-800 hover:underline"
          >
            Evidence case →
          </Link>
        </div>
      ) : null}
      {ach.trainer_comments ? <p className="text-xs text-slate-600 whitespace-pre-wrap">“{ach.trainer_comments}”</p> : null}
      {snap && Object.keys(snap).length ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-slate-600">Case metrics snapshot</summary>
          <p className="mt-1 text-[11px] text-slate-500 bg-slate-50 rounded px-2 py-1 font-mono break-all">{JSON.stringify(snap)}</p>
        </details>
      ) : null}
      {manualKeys.length ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-slate-600">Manual capture fields</summary>
          <ul className="mt-1 text-[11px] text-slate-600 list-disc list-inside">
            {manualKeys.map((k) => (
              <li key={k}>
                {k}: {String(cap[k])}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function SignOffForm({
  doctorId,
  step,
  cases,
  stepUi,
  defaultEvidenceCaseId,
  metricsCaseSet,
  onDone,
}: {
  doctorId: string;
  step: TrainingCompetencyStepRow;
  cases: Pick<TrainingCaseRow, "id" | "surgery_date">[];
  stepUi?: StepUiModel;
  defaultEvidenceCaseId: string | null;
  metricsCaseSet: Set<string>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState("");
  const [caseId, setCaseId] = useState(defaultEvidenceCaseId || "");
  const [demo, setDemo] = useState<PerformanceDemonstration>("repeatable_across_sessions");
  const [sessionDate, setSessionDate] = useState("");
  const [extGrafts, setExtGrafts] = useState("");
  const [impGrafts, setImpGrafts] = useState("");
  const [totalHairs, setTotalHairs] = useState("");
  const [totalGrafts, setTotalGrafts] = useState("");
  const [extMin, setExtMin] = useState("");
  const [impMin, setImpMin] = useState("");
  const [punchSize, setPunchSize] = useState("");
  const [observed, setObserved] = useState(true);
  const [singleOverride, setSingleOverride] = useState(false);

  useEffect(() => {
    setCaseId(defaultEvidenceCaseId || "");
  }, [defaultEvidenceCaseId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const capture: Record<string, unknown> = {};
      if (sessionDate.trim()) capture.session_date = sessionDate.trim();
      const parseOptInt = (s: string) => {
        const n = parseInt(s, 10);
        return Number.isFinite(n) ? n : undefined;
      };
      const parseOptNum = (s: string) => {
        const n = Number(s);
        return Number.isFinite(n) ? n : undefined;
      };
      const eg = parseOptInt(extGrafts);
      const ig = parseOptInt(impGrafts);
      const th = parseOptInt(totalHairs);
      const tg = parseOptInt(totalGrafts);
      const em = parseOptNum(extMin);
      const im = parseOptNum(impMin);
      if (eg !== undefined) capture.extraction_graft_count = eg;
      if (ig !== undefined) capture.implantation_graft_count = ig;
      if (th !== undefined) capture.total_hairs = th;
      if (tg !== undefined) capture.total_grafts = tg;
      if (em !== undefined) capture.extraction_duration_minutes = em;
      if (im !== undefined) capture.implantation_duration_minutes = im;
      if (punchSize.trim()) capture.punch_size = punchSize.trim();
      capture.observed_by_trainer = observed;

      const res = await fetch(`/api/academy/trainees/${doctorId}/competency/achievements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId: step.id,
          evidenceTrainingCaseId: caseId || null,
          trainerComments: comments || null,
          performanceDemonstration: demo,
          capture: Object.keys(capture).length ? capture : undefined,
          singleSessionOverride: step.is_target ? singleOverride : false,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Sign-off failed");
      setComments("");
      setCaseId(defaultEvidenceCaseId || "");
      setSessionDate("");
      setExtGrafts("");
      setImpGrafts("");
      setTotalHairs("");
      setTotalGrafts("");
      setExtMin("");
      setImpMin("");
      setPunchSize("");
      setObserved(true);
      setSingleOverride(false);
      onDone();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sign-off failed");
    } finally {
      setBusy(false);
    }
  }

  const rep = stepUi?.repeatability;
  const needsOverrideHint = step.is_target && rep && !rep.satisfied;

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <div className="text-sm font-semibold text-slate-900">Trainer sign-off</div>
      {needsOverrideHint ? (
        <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1">
          Repeatability counts not met — check override in “More options” below, or add observations first.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label className="block text-[11px] font-medium text-slate-600">Evidence case</label>
          <select
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Optional —</option>
            {[...cases]
              .reverse()
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.surgery_date}
                  {metricsCaseSet.has(c.id) ? " · metrics" : ""}
                </option>
              ))}
          </select>
        </div>
        {defaultEvidenceCaseId ? (
          <button
            type="button"
            onClick={() => setCaseId(defaultEvidenceCaseId)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Case with metrics
          </button>
        ) : null}
      </div>
      <div>
        <span className="text-[11px] font-medium text-slate-600">Performance (tap one)</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {(
            [
              ["single_session_peak", "Peak session"] as const,
              ["repeatable_across_sessions", "Repeatable"] as const,
              ["not_specified", "Unspecified"] as const,
            ] as const
          ).map(([k, short]) => (
            <button
              key={k}
              type="button"
              onClick={() => setDemo(k)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                demo === k ? "border-amber-500 bg-amber-100 text-amber-950" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {short}
            </button>
          ))}
        </div>
        <p className="mt-0.5 text-[10px] text-slate-500">{PERFORMANCE_DEMONSTRATION_LABELS[demo]}</p>
      </div>
      <div>
        <span className="text-[11px] font-medium text-slate-600">Quick notes (optional)</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {SIGNOFF_NOTE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setComments((t) => appendChip(t, chip))}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
            >
              + {chip}
            </button>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Saving…" : "Sign off step"}
      </button>
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">More options (override, manual metrics, free text)</summary>
        <div className="mt-2 space-y-2">
          {needsOverrideHint ? (
            <label className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded p-2">
              <input type="checkbox" checked={singleOverride} onChange={(e) => setSingleOverride(e.target.checked)} className="mt-0.5" />
              <span>
                <strong>Single-session override (targets):</strong> sign off despite unmet repeatability when evidence is sufficient.
              </span>
            </label>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-600">Session date (override)</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600">Punch size</label>
              <input
                value={punchSize}
                onChange={(e) => setPunchSize(e.target.value)}
                placeholder="e.g. 1.0 mm"
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600">Extraction graft count</label>
              <input
                inputMode="numeric"
                value={extGrafts}
                onChange={(e) => setExtGrafts(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600">Implantation graft count</label>
              <input
                inputMode="numeric"
                value={impGrafts}
                onChange={(e) => setImpGrafts(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600">Total hairs</label>
              <input
                inputMode="numeric"
                value={totalHairs}
                onChange={(e) => setTotalHairs(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600">Total grafts</label>
              <input
                inputMode="numeric"
                value={totalGrafts}
                onChange={(e) => setTotalGrafts(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600">Extraction duration (min)</label>
              <input
                inputMode="decimal"
                value={extMin}
                onChange={(e) => setExtMin(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600">Implantation duration (min)</label>
              <input
                inputMode="decimal"
                value={impMin}
                onChange={(e) => setImpMin(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={observed} onChange={(e) => setObserved(e.target.checked)} className="rounded border-slate-300" />
            Observed by trainer (this attempt)
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Free-text comments (optional if you used chips)"
          />
        </div>
      </details>
    </form>
  );
}

function EditSignOffForm({
  doctorId,
  achievementId,
  isTarget,
  initialComments,
  initialDemo,
  initialOverride,
  onDone,
}: {
  doctorId: string;
  achievementId: string;
  isTarget: boolean;
  initialComments: string | null;
  initialDemo: PerformanceDemonstration;
  initialOverride: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState(initialComments || "");
  const [demo, setDemo] = useState<PerformanceDemonstration>(initialDemo);
  const [override, setOverride] = useState(initialOverride);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/academy/trainees/${doctorId}/competency/achievements/${achievementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerComments: comments,
          performanceDemonstration: demo,
          singleSessionOverride: isTarget ? override : false,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      setOpen(false);
      onDone();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-amber-800 hover:underline">
        Edit sign-off details
      </button>
    );
  }

  return (
    <form onSubmit={(e) => void save(e)} className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50/80 p-2">
      {isTarget ? (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          Single-session override flagged
        </label>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["single_session_peak", "Peak"] as const,
            ["repeatable_across_sessions", "Repeatable"] as const,
            ["not_specified", "Unspecified"] as const,
          ] as const
        ).map(([k, short]) => (
          <button
            key={k}
            type="button"
            onClick={() => setDemo(k)}
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
              demo === k ? "border-amber-500 bg-amber-100 text-amber-950" : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {short}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {SIGNOFF_NOTE_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setComments((t) => appendChip(t, chip))}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
          >
            + {chip}
          </button>
        ))}
      </div>
      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        placeholder="Optional free text"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-600 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
