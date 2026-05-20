import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCaseReviewTimeline,
  buildEncouragingSummary,
  buildFacultyReadinessSignal,
  buildImprovementTrendSummary,
  computeDevelopmentalLevelScore,
  developmentalLevelLabel,
  fetchSectionsForReviews,
  getCurrentStrengths,
  getRecommendedNextFocus,
  getRepeatedFocusAreas,
  getTraineeCaseReviewHistory,
  getTraineeSkillProgressSummary,
  type FacultyReadinessSignal,
  type ImprovementTrendSummary,
  type SkillProgressEntry,
  type TimelineEntry,
} from "./progress";
import { fetchLatestSubmittedReviewForTrainee } from "./data";
import type { TrainingCaseReviewRow } from "./types";

export type TraineeSurgicalProgressDashboard = {
  reviewCount: number;
  latestReview: TrainingCaseReviewRow | null;
  latestOverallLevel: string | null;
  latestOverallLevelLabel: string | null;
  encouragingSummary: string;
  skillProgress: SkillProgressEntry[];
  timeline: TimelineEntry[];
  improvementTrend: ImprovementTrendSummary;
  currentStrengths: string[];
  recommendedNextFocus: string[];
  repeatedFocusAreas: string[];
  facultyReadiness: FacultyReadinessSignal;
};

export async function buildTraineeSurgicalProgressDashboard(
  supabase: SupabaseClient,
  traineeId: string,
  opts?: { includeDrafts?: boolean },
): Promise<TraineeSurgicalProgressDashboard> {
  const reviewsNewestFirst = await getTraineeCaseReviewHistory(supabase, traineeId, {
    includeDrafts: opts?.includeDrafts ?? false,
  });

  const latestReview =
    reviewsNewestFirst.find((r) => r.review_status === "submitted") ??
    (await fetchLatestSubmittedReviewForTrainee(supabase, traineeId).catch(() => null));

  const reviewIds = reviewsNewestFirst.map((r) => r.id);
  const sectionsByReviewId = await fetchSectionsForReviews(supabase, reviewIds);

  const skillProgress = getTraineeSkillProgressSummary({ reviewsNewestFirst, sectionsByReviewId });
  const repeatedFocusAreas = getRepeatedFocusAreas({ reviewsNewestFirst, sectionsByReviewId });
  const currentStrengths = getCurrentStrengths({
    latestReview,
    reviewsNewestFirst,
    sectionsByReviewId,
  });
  const recommendedNextFocus = getRecommendedNextFocus({ latestReview, repeatedFocusAreas });
  const timeline = buildCaseReviewTimeline({ reviewsNewestFirst });
  const improvementTrend = buildImprovementTrendSummary({
    skillProgress,
    latestReview,
    reviewsNewestFirst,
    sectionsByReviewId,
  });
  const encouragingSummary = buildEncouragingSummary({
    latestReview,
    skillProgress,
    recommendedNextFocus,
  });
  const facultyReadiness = buildFacultyReadinessSignal({
    reviewsNewestFirst,
    skillProgress,
    currentStrengths,
    repeatedFocusAreas,
  });

  const submitted = reviewsNewestFirst.filter((r) => r.review_status === "submitted");

  return {
    reviewCount: submitted.length,
    latestReview,
    latestOverallLevel: latestReview?.overall_level ?? null,
    latestOverallLevelLabel: developmentalLevelLabel(latestReview?.overall_level),
    encouragingSummary,
    skillProgress,
    timeline,
    improvementTrend,
    currentStrengths,
    recommendedNextFocus,
    repeatedFocusAreas,
    facultyReadiness,
  };
}

/** Overall training progress percentage from submitted reviews (0–100). */
export function computeOverallTrainingProgressFromReviews(reviewCount: number, skillProgress: SkillProgressEntry[]): number {
  if (reviewCount === 0) return 0;
  const scored = skillProgress.filter((s) => computeDevelopmentalLevelScore(s.currentLevel) > 0);
  if (!scored.length) return Math.min(100, reviewCount * 15);
  const avg = scored.reduce((sum, s) => sum + computeDevelopmentalLevelScore(s.currentLevel), 0) / scored.length;
  const volumeFactor = Math.min(1, reviewCount / 5);
  return Math.round(((avg / 5) * 0.7 + volumeFactor * 0.3) * 100);
}

export {
  computeDevelopmentalLevelScore,
  computeSkillTrend,
  developmentalLevelLabel,
  getCurrentStrengths,
  getRecommendedNextFocus,
  getRepeatedFocusAreas,
  getTraineeCaseReviewHistory,
  getTraineeSkillProgressSummary,
  type FacultyReadinessSignal,
  type ImprovementTrendSummary,
  type SkillProgressEntry,
  type TimelineEntry,
} from "./progress";

export { fetchLatestSubmittedReviewForTrainee as getLatestSubmittedTrainingCaseReview } from "./data";
