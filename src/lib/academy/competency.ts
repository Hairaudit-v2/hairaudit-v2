import { metricsSuggestStepCriteria } from "./competencyMetricsCriteria";
import type {
  PerformanceDemonstration,
  TrainingCaseMetricsRow,
  TrainingCaseRow,
  TrainingCompetencyAchievementRow,
  TrainingCompetencyLadderRow,
  TrainingCompetencyStepRow,
  TrainingDoctorRow,
} from "./types";

export type LadderWithSteps = TrainingCompetencyLadderRow & {
  steps: TrainingCompetencyStepRow[];
};

export function groupStepsByLadder(
  ladders: TrainingCompetencyLadderRow[],
  steps: TrainingCompetencyStepRow[]
): LadderWithSteps[] {
  const byLadder = new Map<string, TrainingCompetencyStepRow[]>();
  for (const s of steps) {
    const list = byLadder.get(s.ladder_id) ?? [];
    list.push(s);
    byLadder.set(s.ladder_id, list);
  }
  for (const list of byLadder.values()) {
    list.sort((a, b) => a.step_index - b.step_index);
  }
  return ladders.map((l) => ({
    ...l,
    steps: byLadder.get(l.id) ?? [],
  }));
}

/** Mandatory prerequisite steps (lower index) must be achieved before this step can be signed off. */
export function isStepUnlockedForSignoff(
  ladderSteps: TrainingCompetencyStepRow[],
  achievedStepIds: Set<string>,
  stepId: string
): boolean {
  const sorted = [...ladderSteps].sort((a, b) => a.step_index - b.step_index);
  const target = sorted.find((s) => s.id === stepId);
  if (!target) return false;
  for (const s of sorted) {
    if (s.step_index >= target.step_index) break;
    if (s.is_optional) continue;
    if (!achievedStepIds.has(s.id)) return false;
  }
  return true;
}

export function highestAchievedIndex(
  ladderSteps: TrainingCompetencyStepRow[],
  achievedStepIds: Set<string>
): number {
  let max = -1;
  for (const s of ladderSteps) {
    if (achievedStepIds.has(s.id)) max = Math.max(max, s.step_index);
  }
  return max;
}

export function targetStepIds(ladderSteps: TrainingCompetencyStepRow[]): Set<string> {
  return new Set(ladderSteps.filter((s) => s.is_target).map((s) => s.id));
}

/** All required target milestones across ladders achieved (one target step per seeded ladder). */
export function allTargetMilestonesAchieved(
  laddersWithSteps: LadderWithSteps[],
  achievedStepIds: Set<string>
): boolean {
  for (const l of laddersWithSteps) {
    const targets = l.steps.filter((s) => s.is_target);
    if (targets.length === 0) continue;
    for (const t of targets) {
      if (!achievedStepIds.has(t.id)) return false;
    }
  }
  return true;
}

export type WeekBucket = {
  weekIndex: number;
  label: string;
  caseCount: number;
  achievementCount: number;
};

export function competencyWaveAnchor(doctor: Pick<TrainingDoctorRow, "competency_wave_start_date" | "start_date">): Date | null {
  const raw = doctor.competency_wave_start_date || doctor.start_date;
  if (!raw) return null;
  const d = new Date(`${raw}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Inclusive date window for week k (1–4) from wave anchor (calendar days). */
export function competencyWeekDateWindow(
  waveStart: Date,
  weekNumber1Based: number
): { start: string; end: string } {
  const s = new Date(waveStart.getTime());
  s.setDate(s.getDate() + (weekNumber1Based - 1) * 7);
  const e = new Date(s.getTime());
  e.setDate(e.getDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(s), end: iso(e) };
}

export function buildFourWeekOverview(input: {
  waveStart: Date | null;
  cases: Pick<TrainingCaseRow, "id" | "surgery_date">[];
  achievements: Pick<TrainingCompetencyAchievementRow, "achieved_at">[];
}): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  for (let w = 1; w <= 4; w++) {
    buckets.push({ weekIndex: w, label: `Week ${w}`, caseCount: 0, achievementCount: 0 });
  }
  if (!input.waveStart) {
    return buckets;
  }
  const start = input.waveStart.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  for (const c of input.cases) {
    const t = new Date(`${c.surgery_date}T12:00:00`).getTime();
    if (!Number.isFinite(t)) continue;
    const idx = Math.floor((t - start) / weekMs);
    if (idx >= 0 && idx < 4) buckets[idx].caseCount += 1;
  }
  for (const a of input.achievements) {
    const t = new Date(a.achieved_at).getTime();
    if (!Number.isFinite(t)) continue;
    const idx = Math.floor((t - start) / weekMs);
    if (idx >= 0 && idx < 4) buckets[idx].achievementCount += 1;
  }
  return buckets;
}

/**
 * Informational only — never used to auto-complete milestones.
 * Returns step ids whose criteria appear met by latest metrics (trainer still must sign off).
 */
export function suggestStepIdsFromLatestMetrics(
  laddersWithSteps: LadderWithSteps[],
  metrics: TrainingCaseMetricsRow | null
): string[] {
  if (!metrics) return [];
  const suggested: string[] = [];
  for (const ladder of laddersWithSteps) {
    for (const step of ladder.steps) {
      if (metricsSuggestStepCriteria(step, metrics)) suggested.push(step.id);
    }
  }
  return suggested;
}

export const PERFORMANCE_DEMONSTRATION_LABELS: Record<PerformanceDemonstration, string> = {
  not_specified: "Not specified",
  single_session_peak: "Seen in a session (may be peak)",
  repeatable_across_sessions: "Repeatable across sessions",
};
