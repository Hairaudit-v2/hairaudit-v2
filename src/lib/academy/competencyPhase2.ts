import type { LadderWithSteps } from "./competency";
import { metricsSuggestStepCriteria } from "./competencyMetricsCriteria";
import type {
  TrainingCaseMetricsRow,
  TrainingCaseRow,
  TrainingCompetencyAchievementRow,
  TrainingCompetencyStepObservationRow,
  TrainingCompetencyStepRow,
  TrainingCompetencyStepStateRow,
  TrainingDoctorRow,
} from "./types";

export type CompetencyStepStatus =
  | "not_started"
  | "in_progress"
  | "threshold_reached"
  | "awaiting_signoff"
  | "signed_off"
  | "needs_repeat"
  | "regressed"
  | "waived_optional";

export type CompetencyFinalReadinessStatus =
  | "ready"
  | "ready_with_limitations"
  | "extended_training_required"
  | "not_ready";

export type RepeatabilityRequirements = {
  minSignedObservations: number;
  minDistinctCases: number;
  requiresTrainerObservation: boolean;
  ruleJson: Record<string, unknown>;
};

export type ObservationStats = {
  totalCounting: number;
  distinctCaseIds: Set<string>;
};

export type RepeatabilityEvaluation = {
  satisfied: boolean;
  minSignedObservations: number;
  minDistinctCases: number;
  countingObservations: number;
  distinctCasesMet: number;
  requiresTrainerObservation: boolean;
};

export function effectiveRepeatabilityRequirements(step: TrainingCompetencyStepRow): RepeatabilityRequirements {
  const minObs =
    step.min_signed_observations != null && Number.isFinite(Number(step.min_signed_observations))
      ? Math.max(0, Number(step.min_signed_observations))
      : step.is_target
        ? 2
        : 0;
  const minCases =
    step.min_distinct_cases != null && Number.isFinite(Number(step.min_distinct_cases))
      ? Math.max(0, Number(step.min_distinct_cases))
      : step.is_target
        ? 2
        : 0;
  const ruleJson =
    step.repeatability_rule_json && typeof step.repeatability_rule_json === "object"
      ? (step.repeatability_rule_json as Record<string, unknown>)
      : {};
  return {
    minSignedObservations: minObs,
    minDistinctCases: minCases,
    requiresTrainerObservation: Boolean(step.requires_trainer_observation),
    ruleJson,
  };
}

export function filterCountingObservations(
  observations: TrainingCompetencyStepObservationRow[],
  req: RepeatabilityRequirements
): TrainingCompetencyStepObservationRow[] {
  return observations.filter((o) => {
    if (!o.threshold_met) return false;
    if (req.requiresTrainerObservation && !o.trainer_observed) return false;
    return true;
  });
}

export function observationStats(
  observations: TrainingCompetencyStepObservationRow[],
  req: RepeatabilityRequirements
): ObservationStats {
  const counting = filterCountingObservations(observations, req);
  const distinctCaseIds = new Set<string>();
  for (const o of counting) {
    if (o.training_case_id) distinctCaseIds.add(o.training_case_id);
  }
  return { totalCounting: counting.length, distinctCaseIds };
}

export function evaluateRepeatability(
  step: TrainingCompetencyStepRow,
  observations: TrainingCompetencyStepObservationRow[]
): RepeatabilityEvaluation {
  const req = effectiveRepeatabilityRequirements(step);
  const stats = observationStats(observations, req);
  const distinctCasesMet = stats.distinctCaseIds.size;
  const satisfied = stats.totalCounting >= req.minSignedObservations && distinctCasesMet >= req.minDistinctCases;
  return {
    satisfied,
    minSignedObservations: req.minSignedObservations,
    minDistinctCases: req.minDistinctCases,
    countingObservations: stats.totalCounting,
    distinctCasesMet,
    requiresTrainerObservation: req.requiresTrainerObservation,
  };
}

export type ThresholdContext = {
  metricsByCaseId: Map<string, TrainingCaseMetricsRow>;
  casesChronological: Pick<TrainingCaseRow, "id" | "surgery_date">[];
  latestMetrics: TrainingCaseMetricsRow | null;
};

export function thresholdMetOnAnyCase(step: TrainingCompetencyStepRow, ctx: ThresholdContext): boolean {
  for (const c of ctx.casesChronological) {
    const m = ctx.metricsByCaseId.get(c.id);
    if (m && metricsSuggestStepCriteria(step, m)) return true;
  }
  return false;
}

export function thresholdMetLatest(step: TrainingCompetencyStepRow, ctx: ThresholdContext): boolean {
  if (!ctx.latestMetrics) return false;
  const latestCaseId = [...ctx.casesChronological].reverse().find((c) => ctx.metricsByCaseId.has(c.id))?.id;
  if (!latestCaseId) return false;
  const m = ctx.metricsByCaseId.get(latestCaseId);
  return m ? metricsSuggestStepCriteria(step, m) : false;
}

/**
 * Derives UI status. Trainer-persisted flags in stateRow take precedence over pure derivation
 * except signed_off always wins when achievement exists.
 */
export function computeEffectiveStepStatus(input: {
  step: TrainingCompetencyStepRow;
  achievement: TrainingCompetencyAchievementRow | null;
  stateRow: TrainingCompetencyStepStateRow | null;
  observations: TrainingCompetencyStepObservationRow[];
  thresholdCtx: ThresholdContext;
}): CompetencyStepStatus {
  const { step, achievement, stateRow, observations, thresholdCtx } = input;
  if (achievement) return "signed_off";

  const persisted = stateRow?.status;
  if (step.is_optional && persisted === "waived_optional") return "waived_optional";
  if (persisted === "needs_repeat") return "needs_repeat";
  if (persisted === "regressed") return "regressed";
  if (persisted === "in_progress") return "in_progress";
  if (persisted === "awaiting_signoff") return "awaiting_signoff";
  if (persisted === "threshold_reached") return "threshold_reached";

  const rep = evaluateRepeatability(step, observations);
  const anyThreshold = thresholdMetOnAnyCase(step, thresholdCtx);
  const latestThreshold = thresholdMetLatest(step, thresholdCtx);

  if (rep.satisfied && (anyThreshold || filterCountingObservations(observations, effectiveRepeatabilityRequirements(step)).length > 0)) {
    return "awaiting_signoff";
  }

  if (anyThreshold || latestThreshold || observations.some((o) => o.threshold_met)) {
    return "threshold_reached";
  }

  if (observations.length > 0) return "in_progress";

  return "not_started";
}

export function guardrailWarningsForStep(input: {
  step: TrainingCompetencyStepRow;
  status: CompetencyStepStatus;
  achievement: TrainingCompetencyAchievementRow | null;
  repeatability: RepeatabilityEvaluation;
  latestSuggestsThreshold: boolean;
  rawObservationCount: number;
}): string[] {
  const w: string[] = [];
  const { step, status, achievement, repeatability, latestSuggestsThreshold, rawObservationCount } = input;

  if (achievement) return w;

  if (latestSuggestsThreshold && !repeatability.satisfied && step.is_target) {
    w.push(
      "Latest case metrics suggest this target threshold, but repeatability requirements are not yet met. Log signed observations on distinct cases or use explicit single-session override on sign-off."
    );
  }

  if (status === "threshold_reached" && !repeatability.satisfied) {
    w.push(
      `Repeatability: ${repeatability.countingObservations}/${repeatability.minSignedObservations} counting observations, ${repeatability.distinctCasesMet}/${repeatability.minDistinctCases} distinct cases.`
    );
  }

  if (repeatability.requiresTrainerObservation && repeatability.countingObservations === 0 && rawObservationCount > 0) {
    w.push("Observations exist but none count toward repeatability — mark trainer-observed where appropriate.");
  }

  return w;
}

export type ReadinessSummary = {
  targetsSignedOff: boolean;
  readinessStatus: CompetencyFinalReadinessStatus | null;
  readinessRecordedAt: string | null;
  headline: string;
};

export type StepUiModel = {
  status: CompetencyStepStatus;
  repeatability: RepeatabilityEvaluation;
  warnings: string[];
  latestSuggestsThreshold: boolean;
};

export function buildStepUiByStepId(input: {
  laddersWithSteps: LadderWithSteps[];
  achievementsByStepId: Map<string, TrainingCompetencyAchievementRow>;
  stateByStepId: Map<string, TrainingCompetencyStepStateRow>;
  observationsByStepId: Map<string, TrainingCompetencyStepObservationRow[]>;
  metricsByCaseId: Map<string, TrainingCaseMetricsRow>;
  casesChronological: Pick<TrainingCaseRow, "id" | "surgery_date">[];
  latestMetrics: TrainingCaseMetricsRow | null;
}): Record<string, StepUiModel> {
  const thresholdCtx: ThresholdContext = {
    metricsByCaseId: input.metricsByCaseId,
    casesChronological: input.casesChronological,
    latestMetrics: input.latestMetrics,
  };
  const out: Record<string, StepUiModel> = {};
  for (const l of input.laddersWithSteps) {
    for (const step of l.steps) {
      const achievement = input.achievementsByStepId.get(step.id) ?? null;
      const stateRow = input.stateByStepId.get(step.id) ?? null;
      const observations = input.observationsByStepId.get(step.id) ?? [];
      const status = computeEffectiveStepStatus({ step, achievement, stateRow, observations, thresholdCtx });
      const repeatability = evaluateRepeatability(step, observations);
      const latestSuggestsThreshold = input.latestMetrics
        ? metricsSuggestStepCriteria(step, input.latestMetrics)
        : false;
      const warnings = guardrailWarningsForStep({
        step,
        status,
        achievement,
        repeatability,
        latestSuggestsThreshold,
        rawObservationCount: observations.length,
      });
      out[step.id] = { status, repeatability, warnings, latestSuggestsThreshold };
    }
  }
  return out;
}

export function buildReadinessSummary(input: {
  doctor: Pick<
    TrainingDoctorRow,
    | "competency_final_readiness_at"
    | "competency_final_readiness_status"
    | "competency_final_readiness_notes"
    | "competency_restrictions_json"
  >;
  allTargetsAchieved: boolean;
}): ReadinessSummary {
  const st = (input.doctor.competency_final_readiness_status || null) as CompetencyFinalReadinessStatus | null;
  const at = input.doctor.competency_final_readiness_at || null;

  let headline = "Readiness not recorded.";
  if (st === "ready") headline = "Ready for supervised independence.";
  else if (st === "ready_with_limitations") headline = "Ready with documented limitations.";
  else if (st === "extended_training_required") headline = "Extended training required.";
  else if (st === "not_ready") headline = "Not ready.";
  else if (at && !st) headline = "Trainer timestamp recorded — set structured status for Phase 2 tracking.";

  return {
    targetsSignedOff: input.allTargetsAchieved,
    readinessStatus: st,
    readinessRecordedAt: at,
    headline,
  };
}
