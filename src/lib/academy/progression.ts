import type {
  TrainingCaseAssessmentRow,
  TrainingCaseMetricsRow,
  TrainingDoctorRow,
} from "./types";

export type TraineeProgressBadge =
  | "on_track"
  | "needs_support"
  | "ready_for_progression"
  | "review_required";

export type TraineeProgressSnapshot = {
  badge: TraineeProgressBadge;
  label: string;
  hints: string[];
  avgTransectionLastN: number | null;
  avgOverallScoreLastN: number | null;
  casesWithMetrics: number;
  lastReviewReadyToProgress: boolean | null;
};

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function numFromUnknown(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lightweight MVP progression signal — blends recent metrics, assessments, and doctor status.
 * Not case-count-only; emphasizes safety (transection) and trainer sign-off.
 */
export function computeTraineeProgressSnapshot(input: {
  doctor: Pick<TrainingDoctorRow, "status" | "current_stage" | "notes">;
  metricsByCaseId: Map<string, TrainingCaseMetricsRow>;
  assessmentsNewestFirst: TrainingCaseAssessmentRow[];
}): TraineeProgressSnapshot {
  const hints: string[] = [];
  const metrics = [...input.metricsByCaseId.values()];
  const transections = metrics
    .map((m) => m.transection_rate)
    .filter((v): v is number => v != null && Number.isFinite(Number(v)))
    .map(Number);
  const last3T = transections.slice(-3);
  const avgTransectionLastN = mean(last3T);

  const assessmentScores = input.assessmentsNewestFirst
    .map((a) => (a.overall_score != null ? Number(a.overall_score) : null))
    .filter((v): v is number => v != null && Number.isFinite(v));
  const avgOverallScoreLastN = mean(assessmentScores.slice(0, 3));

  const latestAssessment = input.assessmentsNewestFirst[0];
  const lastReviewReadyToProgress = latestAssessment?.ready_to_progress ?? null;

  if (input.doctor.status === "withdrawn") {
    return {
      badge: "needs_support",
      label: "Withdrawn",
      hints: ["Trainee marked withdrawn — review notes and program status."],
      avgTransectionLastN,
      avgOverallScoreLastN,
      casesWithMetrics: metrics.length,
      lastReviewReadyToProgress,
    };
  }

  if (input.doctor.status === "paused") {
    hints.push("Program paused — confirm return date and support plan.");
  }

  const criticalTransection =
    avgTransectionLastN != null && avgTransectionLastN > 15;
  if (criticalTransection) {
    hints.push("Recent transection estimates are elevated — prioritize supervised reps and punch review.");
  }

  if (!latestAssessment && metrics.length >= 2) {
    hints.push("Cases logged without a trainer review — schedule assessment.");
  }

  if (latestAssessment && !latestAssessment.signed_off_at) {
    hints.push("Latest assessment not signed off.");
  }

  let badge: TraineeProgressBadge = "on_track";
  if (criticalTransection) badge = "needs_support";
  else if (!latestAssessment && metrics.length >= 3) badge = "review_required";
  else if (lastReviewReadyToProgress && !criticalTransection) badge = "ready_for_progression";
  else if (avgOverallScoreLastN != null && avgOverallScoreLastN < 2.5) badge = "needs_support";

  const labels: Record<TraineeProgressBadge, string> = {
    on_track: "On track",
    needs_support: "Needs support",
    ready_for_progression: "Ready for progression",
    review_required: "Review required",
  };

  return {
    badge,
    label: labels[badge],
    hints,
    avgTransectionLastN,
    avgOverallScoreLastN,
    casesWithMetrics: metrics.length,
    lastReviewReadyToProgress,
  };
}

export function domainAveragesFromAssessments(
  assessmentsNewestFirst: TrainingCaseAssessmentRow[],
  maxAssessments = 5
): Record<string, number> {
  const slice = assessmentsNewestFirst.slice(0, maxAssessments);
  const sums: Record<string, { sum: number; n: number }> = {};
  for (const a of slice) {
    const d = a.domain_scores_json;
    if (!d || typeof d !== "object") continue;
    for (const [k, v] of Object.entries(d)) {
      const n = numFromUnknown(v);
      if (n == null) continue;
      if (!sums[k]) sums[k] = { sum: 0, n: 0 };
      sums[k].sum += n;
      sums[k].n += 1;
    }
  }
  const out: Record<string, number> = {};
  for (const [k, { sum, n }] of Object.entries(sums)) {
    if (n > 0) out[k] = Math.round((sum / n) * 10) / 10;
  }
  return out;
}

export function trendValuesFromCases(
  casesChronological: { id: string }[],
  metricsByCaseId: Map<string, TrainingCaseMetricsRow>,
  field: keyof Pick<
    TrainingCaseMetricsRow,
    "transection_rate" | "implantation_grafts_per_hour" | "extraction_grafts_per_hour"
  >
): number[] {
  return casesChronological
    .map((c) => metricsByCaseId.get(c.id)?.[field])
    .map((v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null))
    .filter((v): v is number => v != null);
}
