import type { SupabaseClient } from "@supabase/supabase-js";
import { DEVELOPMENTAL_LEVEL_LABELS } from "@/lib/academy/trainingCaseReviews";
import type { TrainingCaseReviewRow } from "@/lib/academy/trainingCaseReviews/types";
import type {
  TrainingCompetencyAchievementRow,
  TrainingCompetencyStepObservationRow,
  TrainingCompetencyStepRow,
} from "@/lib/academy/types";

export type ReviewEvidenceView = {
  id: string;
  reviewStatus: TrainingCaseReviewRow["review_status"];
  caseDate: string | null;
  caseType: string | null;
  overallLevel: string | null;
  recommendedNextFocus: string | null;
  trainingCaseId: string | null;
  /** True when the current user may open the review detail page. */
  canView: boolean;
  href: string | null;
};

export type CompetencyReviewLinkRow = {
  kind: "achievement" | "observation";
  id: string;
  stepId: string;
  stepLabel: string;
  ladderTitle: string;
  achievedAt?: string;
  createdAt?: string;
};

export function formatReviewEvidenceLabel(review: Pick<
  TrainingCaseReviewRow,
  "case_date" | "case_type" | "overall_level" | "recommended_next_focus"
>): string {
  const parts: string[] = [];
  if (review.case_date) parts.push(review.case_date);
  if (review.case_type) parts.push(review.case_type);
  if (review.overall_level) {
    const label =
      review.overall_level in DEVELOPMENTAL_LEVEL_LABELS
        ? DEVELOPMENTAL_LEVEL_LABELS[review.overall_level as keyof typeof DEVELOPMENTAL_LEVEL_LABELS]
        : review.overall_level.replace(/_/g, " ");
    parts.push(label);
  }
  if (review.recommended_next_focus) {
    const focus =
      review.recommended_next_focus.length > 48
        ? `${review.recommended_next_focus.slice(0, 48)}…`
        : review.recommended_next_focus;
    parts.push(`Focus: ${focus}`);
  }
  return parts.length ? parts.join(" · ") : "Submitted case review";
}

export function buildReviewEvidenceHref(review: Pick<TrainingCaseReviewRow, "id" | "training_case_id">): string | null {
  if (!review.training_case_id) return null;
  return `/academy/training-cases/${review.training_case_id}?reviewId=${review.id}`;
}

export function buildReviewEvidenceView(
  review: TrainingCaseReviewRow,
  opts: { isStaff: boolean },
): ReviewEvidenceView {
  const canView = opts.isStaff || review.review_status === "submitted";
  return {
    id: review.id,
    reviewStatus: review.review_status,
    caseDate: review.case_date,
    caseType: review.case_type,
    overallLevel: review.overall_level,
    recommendedNextFocus: review.recommended_next_focus,
    trainingCaseId: review.training_case_id,
    canView,
    href: canView ? buildReviewEvidenceHref(review) : null,
  };
}

export function buildReviewEvidenceMap(
  reviews: TrainingCaseReviewRow[],
  opts: { isStaff: boolean },
): Record<string, ReviewEvidenceView> {
  const map: Record<string, ReviewEvidenceView> = {};
  for (const review of reviews) {
    map[review.id] = buildReviewEvidenceView(review, opts);
  }
  return map;
}

export async function validateEvidenceTrainingCaseReview(
  supabase: SupabaseClient,
  reviewId: string,
  trainingDoctorId: string,
): Promise<{ ok: true; review: TrainingCaseReviewRow } | { ok: false; error: string }> {
  const { data: review, error } = await supabase
    .from("training_case_reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !review) {
    return { ok: false, error: "Training case review not found" };
  }

  const row = review as TrainingCaseReviewRow;
  if (row.trainee_id !== trainingDoctorId) {
    return { ok: false, error: "Review does not belong to this trainee" };
  }
  if (row.review_status !== "submitted") {
    return { ok: false, error: "Only submitted training case reviews may be linked as competency evidence" };
  }

  return { ok: true, review: row };
}

export async function fetchCompetencyLinksForReview(
  supabase: SupabaseClient,
  reviewId: string,
): Promise<CompetencyReviewLinkRow[]> {
  const [{ data: achievements }, { data: observations }, { data: steps }, { data: ladders }] = await Promise.all([
    supabase
      .from("training_competency_achievements")
      .select("id, step_id, achieved_at")
      .eq("evidence_training_case_review_id", reviewId),
    supabase
      .from("training_competency_step_observations")
      .select("id, step_id, created_at")
      .eq("evidence_training_case_review_id", reviewId),
    supabase.from("training_competency_steps").select("id, label, short_label, ladder_id"),
    supabase.from("training_competency_ladders").select("id, title"),
  ]);

  const stepById = new Map((steps ?? []).map((s) => [s.id as string, s as TrainingCompetencyStepRow]));
  const ladderTitleById = new Map((ladders ?? []).map((l) => [l.id as string, (l as { title: string }).title]));

  const resolveStep = (stepId: string) => {
    const step = stepById.get(stepId);
    const ladderTitle = step ? ladderTitleById.get(step.ladder_id) ?? "Competency" : "Competency";
    return {
      stepLabel: step?.short_label || step?.label || "Step",
      ladderTitle,
    };
  };

  const rows: CompetencyReviewLinkRow[] = [];
  for (const ach of (achievements ?? []) as Pick<TrainingCompetencyAchievementRow, "id" | "step_id" | "achieved_at">[]) {
    const meta = resolveStep(ach.step_id);
    rows.push({
      kind: "achievement",
      id: ach.id,
      stepId: ach.step_id,
      stepLabel: meta.stepLabel,
      ladderTitle: meta.ladderTitle,
      achievedAt: ach.achieved_at,
    });
  }
  for (const obs of (observations ?? []) as Pick<
    TrainingCompetencyStepObservationRow,
    "id" | "step_id" | "created_at"
  >[]) {
    const meta = resolveStep(obs.step_id);
    rows.push({
      kind: "observation",
      id: obs.id,
      stepId: obs.step_id,
      stepLabel: meta.stepLabel,
      ladderTitle: meta.ladderTitle,
      createdAt: obs.created_at,
    });
  }

  return rows.sort((a, b) => {
    const ta = a.achievedAt ?? a.createdAt ?? "";
    const tb = b.achievedAt ?? b.createdAt ?? "";
    return tb.localeCompare(ta);
  });
}
