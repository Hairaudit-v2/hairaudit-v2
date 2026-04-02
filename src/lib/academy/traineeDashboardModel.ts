import type { TraineeProgressBadge, TraineeProgressSnapshot } from "./progression";
import type { CompetencyFinalReadinessStatus, CompetencyStepStatus } from "./competencyPhase2";
import type { LadderWithSteps } from "./competency";
import type { TrainingCompetencyStepRow, TrainingCompetencyWeeklyReviewRow } from "./types";

export type TraineeTrajectoryPhase =
  | "not_yet_ready"
  | "progressing"
  | "on_track"
  | "approaching_readiness"
  | "ready_with_limitations"
  | "ready";

export type TraineeTrajectoryPoint = {
  key: TraineeTrajectoryPhase;
  label: string;
  description: string;
};

export const TRAJECTORY_POINTS: TraineeTrajectoryPoint[] = [
  {
    key: "not_yet_ready",
    label: "Not yet ready",
    description: "Early exposure; milestones and reviews still forming.",
  },
  {
    key: "progressing",
    label: "Progressing",
    description: "Building volume, consistency, and supervised judgement.",
  },
  {
    key: "on_track",
    label: "On track",
    description: "Signals align with expected supervised progression.",
  },
  {
    key: "approaching_readiness",
    label: "Approaching readiness",
    description: "Targets tightening; final sign-off conversations expected.",
  },
  {
    key: "ready_with_limitations",
    label: "Ready with limitations",
    description: "Independent elements approved with documented guardrails.",
  },
  { key: "ready", label: "Ready", description: "Trainer-recorded readiness for supervised independence." },
];

function trajectoryIndexForPhase(phase: TraineeTrajectoryPhase): number {
  return TRAJECTORY_POINTS.findIndex((p) => p.key === phase);
}

/** Discrete trainee-facing trajectory — informational; trainer sign-off and DB readiness remain authoritative. */
export function computeTraineeTrajectoryPhase(input: {
  readinessStatus: CompetencyFinalReadinessStatus | null;
  snapshotBadge: TraineeProgressBadge;
  signedTargetCount: number;
  totalTargets: number;
  caseCount: number;
  achievementCount: number;
}): { phase: TraineeTrajectoryPhase; activeIndex: number; blurb: string } {
  const { readinessStatus, snapshotBadge, signedTargetCount, totalTargets, caseCount, achievementCount } = input;
  const frac = totalTargets > 0 ? signedTargetCount / totalTargets : achievementCount > 0 ? 0.35 : 0;

  if (readinessStatus === "ready") {
    return {
      phase: "ready",
      activeIndex: trajectoryIndexForPhase("ready"),
      blurb: TRAJECTORY_POINTS[trajectoryIndexForPhase("ready")]!.description,
    };
  }
  if (readinessStatus === "ready_with_limitations") {
    return {
      phase: "ready_with_limitations",
      activeIndex: trajectoryIndexForPhase("ready_with_limitations"),
      blurb: TRAJECTORY_POINTS[trajectoryIndexForPhase("ready_with_limitations")]!.description,
    };
  }
  if (readinessStatus === "extended_training_required") {
    return {
      phase: "progressing",
      activeIndex: trajectoryIndexForPhase("progressing"),
      blurb: "Extended pathway in effect — your faculty team will set the next concrete targets.",
    };
  }
  if (readinessStatus === "not_ready") {
    return {
      phase: "not_yet_ready",
      activeIndex: trajectoryIndexForPhase("not_yet_ready"),
      blurb: "Formal readiness not yet recorded. Continue documented supervised work and reviews.",
    };
  }

  if (caseCount === 0 && achievementCount === 0) {
    return {
      phase: "not_yet_ready",
      activeIndex: trajectoryIndexForPhase("not_yet_ready"),
      blurb: "Programme start — log cases and attend reviews so your trajectory can be measured.",
    };
  }

  if (snapshotBadge === "ready_for_progression" || (totalTargets > 0 && frac >= 0.85)) {
    return {
      phase: "approaching_readiness",
      activeIndex: trajectoryIndexForPhase("approaching_readiness"),
      blurb: "You are nearing formal milestone completion — expect focused sign-off discussions.",
    };
  }

  if (snapshotBadge === "needs_support") {
    return {
      phase: "progressing",
      activeIndex: trajectoryIndexForPhase("progressing"),
      blurb: "Supervisory emphasis recommended; align with your trainer on the next supervised steps.",
    };
  }

  if (snapshotBadge === "review_required") {
    return {
      phase: "progressing",
      activeIndex: trajectoryIndexForPhase("progressing"),
      blurb: "Reviews or sign-offs are pending — schedule trainer assessment where needed.",
    };
  }

  if (snapshotBadge === "on_track") {
    if (frac < 0.35 && totalTargets > 0) {
      return {
        phase: "progressing",
        activeIndex: trajectoryIndexForPhase("progressing"),
        blurb: "Early milestone phase — maintain case documentation and observation cadence.",
      };
    }
    return {
      phase: "on_track",
      activeIndex: trajectoryIndexForPhase("on_track"),
      blurb: TRAJECTORY_POINTS[trajectoryIndexForPhase("on_track")]!.description,
    };
  }

  return {
    phase: "on_track",
    activeIndex: trajectoryIndexForPhase("on_track"),
    blurb: TRAJECTORY_POINTS[trajectoryIndexForPhase("on_track")]!.description,
  };
}

export function countTargetMilestones(ladders: LadderWithSteps[]): number {
  let n = 0;
  for (const l of ladders) {
    for (const s of l.steps) {
      if (s.is_target) n += 1;
    }
  }
  return n;
}

export function countSignedTargetMilestones(
  ladders: LadderWithSteps[],
  achievedStepIds: Set<string>
): number {
  let n = 0;
  for (const l of ladders) {
    for (const s of l.steps) {
      if (s.is_target && achievedStepIds.has(s.id)) n += 1;
    }
  }
  return n;
}

export function findNextUnsignedTargetStep(
  ladders: LadderWithSteps[],
  achievedStepIds: Set<string>
): { ladderTitle: string; step: TrainingCompetencyStepRow } | null {
  for (const l of ladders) {
    const sorted = [...l.steps].sort((a, b) => a.step_index - b.step_index);
    for (const s of sorted) {
      if (s.is_target && !achievedStepIds.has(s.id)) {
        return { ladderTitle: l.title, step: s };
      }
    }
  }
  return null;
}

export function findActiveWorkStep(
  ladders: LadderWithSteps[],
  stepUi: Record<
    string,
    { status: CompetencyStepStatus; latestSuggestsThreshold: boolean }
  >
): { ladderTitle: string; step: TrainingCompetencyStepRow; status: CompetencyStepStatus } | null {
  const priority: CompetencyStepStatus[] = [
    "awaiting_signoff",
    "threshold_reached",
    "in_progress",
    "needs_repeat",
    "regressed",
  ];
  for (const pri of priority) {
    for (const l of ladders) {
      const sorted = [...l.steps].sort((a, b) => a.step_index - b.step_index);
      for (const s of sorted) {
        const ui = stepUi[s.id];
        if (ui?.status === pri) {
          return { ladderTitle: l.title, step: s, status: pri };
        }
      }
    }
  }
  return null;
}

const WEEK_FOCUS_FALLBACK: Record<number, string[]> = {
  1: [
    "Settle operative documentation rhythm and case logging discipline.",
    "Prioritise supervised extraction ergonomics and punch handling.",
  ],
  2: [
    "Increase structured repetition while maintaining safety guardrails.",
    "Tighten transection awareness and intra-operative communication.",
  ],
  3: [
    "Consolidate speed elements only after quality thresholds hold.",
    "Prepare evidence packs for milestone sign-off conversations.",
  ],
  4: [
    "Integration week — align limitations, independence, and follow-up plans with faculty.",
    "Review cumulative metrics and weekly faculty feedback themes.",
  ],
};

export function buildWeekFocusBullets(input: {
  competencyWeek: number | null;
  reviewForWeek: TrainingCompetencyWeeklyReviewRow | null;
}): string[] {
  const { competencyWeek, reviewForWeek } = input;
  const fromReview = reviewForWeek?.recommended_next_targets?.trim();
  if (fromReview) {
    return fromReview
      .split(/\n|•|;/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  if (competencyWeek != null && WEEK_FOCUS_FALLBACK[competencyWeek]) {
    return [...WEEK_FOCUS_FALLBACK[competencyWeek]!];
  }
  return [
    "Maintain regular case logging with complete metrics capture.",
    "Schedule or complete your weekly faculty review when due.",
  ];
}

export function pickReviewForCompetencyWeek(
  reviews: TrainingCompetencyWeeklyReviewRow[],
  competencyWeek: number | null
): TrainingCompetencyWeeklyReviewRow | null {
  if (!reviews.length) return null;
  if (competencyWeek != null) {
    const match = reviews.find((r) => r.week_number === competencyWeek);
    if (match) return match;
  }
  const sorted = [...reviews].sort(
    (a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
  );
  return sorted[0] ?? null;
}

export function weeklyReviewDoneForWeek(
  reviews: TrainingCompetencyWeeklyReviewRow[],
  competencyWeek: number | null
): boolean {
  if (competencyWeek == null) return false;
  return reviews.some((r) => r.week_number === competencyWeek);
}

export function buildTrackingHeadline(input: {
  snapshot: TraineeProgressSnapshot;
  trajectoryBlurb: string;
  readinessHeadline: string | null;
  competencyWeek: number | null;
}): string {
  const parts: string[] = [];
  if (input.readinessHeadline && !input.readinessHeadline.includes("not recorded")) {
    parts.push(input.readinessHeadline);
  }
  parts.push(`Performance signal: ${input.snapshot.label.toLowerCase()}.`);
  if (input.competencyWeek != null) {
    parts.push(`Competency wave week ${input.competencyWeek} of 4.`);
  }
  parts.push(input.trajectoryBlurb);
  return parts.join(" ");
}

export function traineeStepStatusLabel(status: CompetencyStepStatus): string {
  switch (status) {
    case "signed_off":
      return "Achieved";
    case "awaiting_signoff":
      return "Awaiting trainer sign-off";
    case "threshold_reached":
      return "Threshold surfaced — repeatability pending";
    case "in_progress":
      return "In progress";
    case "not_started":
      return "Locked / not started";
    case "needs_repeat":
      return "Needs repeat demonstration";
    case "regressed":
      return "Under review";
    case "waived_optional":
      return "Optional — waived";
    default:
      return status;
  }
}

export function traineeStepStatusAccent(status: CompetencyStepStatus): "ok" | "warn" | "neutral" | "muted" {
  if (status === "signed_off" || status === "waived_optional") return "ok";
  if (status === "awaiting_signoff") return "warn";
  if (status === "needs_repeat" || status === "regressed") return "warn";
  if (status === "threshold_reached" || status === "in_progress") return "neutral";
  return "muted";
}
