import type { SupabaseClient } from "@supabase/supabase-js";
import { DEVELOPMENTAL_LEVEL_LABELS, isDevelopmentalLevel } from "./schema";
import { TRAINING_CASE_REVIEW_SECTIONS } from "./reviewSections";
import type {
  DevelopmentalLevel,
  TrainingCaseReviewRow,
  TrainingCaseReviewSectionRow,
} from "./types";

/** Ordered developmental levels (low → high). */
export const DEVELOPMENTAL_LEVEL_ORDER: DevelopmentalLevel[] = [
  "needs_faculty_support",
  "developing",
  "competent_for_stage",
  "strong",
  "advanced_trainee",
];

export type SkillTrendLabel =
  | "improving"
  | "stable"
  | "needs_attention"
  | "new_skill_area"
  | "not_enough_data";

export type SkillClassification = "strength" | "stable" | "focus_area";

/** Dashboard surgical skill domains mapped to review section keys. */
export const SURGICAL_SKILL_DOMAINS: {
  key: string;
  title: string;
  sectionKey: string;
}[] = [
  { key: "case_planning", title: "Case planning", sectionKey: "case_preparation" },
  { key: "donor_management", title: "Donor management", sectionKey: "donor_management" },
  { key: "extraction_pattern", title: "Extraction pattern", sectionKey: "extraction_pattern" },
  { key: "graft_quality", title: "Graft quality", sectionKey: "graft_quality" },
  { key: "graft_handling", title: "Graft handling", sectionKey: "graft_handling" },
  { key: "hairline_design", title: "Hairline design", sectionKey: "hairline_design" },
  { key: "recipient_design", title: "Recipient-site design", sectionKey: "recipient_design" },
  { key: "direction_angle", title: "Direction and angle control", sectionKey: "direction_angle" },
  { key: "density_planning", title: "Density planning", sectionKey: "density_planning" },
  { key: "implantation_quality", title: "Implantation quality", sectionKey: "implantation_quality" },
  { key: "tissue_handling", title: "Tissue handling", sectionKey: "bleeding_trauma" },
  { key: "documentation", title: "Documentation and communication", sectionKey: "communication_docs" },
];

export function computeDevelopmentalLevelScore(level: string | null | undefined): number {
  if (!level || !isDevelopmentalLevel(level)) return 0;
  const idx = DEVELOPMENTAL_LEVEL_ORDER.indexOf(level);
  return idx >= 0 ? idx + 1 : 0;
}

export function developmentalLevelLabel(level: string | null | undefined): string | null {
  if (!level) return null;
  if (isDevelopmentalLevel(level)) return DEVELOPMENTAL_LEVEL_LABELS[level];
  return level;
}

export function computeSkillTrend(
  currentLevel: string | null | undefined,
  previousLevel: string | null | undefined,
  reviewCount: number,
): SkillTrendLabel {
  if (reviewCount < 2) return "not_enough_data";
  if (!previousLevel && currentLevel) return "new_skill_area";
  if (!currentLevel && !previousLevel) return "not_enough_data";

  const cur = computeDevelopmentalLevelScore(currentLevel);
  const prev = computeDevelopmentalLevelScore(previousLevel);

  if (cur === 0 && prev === 0) return "not_enough_data";
  if (cur > prev) return "improving";
  if (cur < prev) return "needs_attention";
  return "stable";
}

export function classifySkill(
  level: string | null | undefined,
  trend: SkillTrendLabel,
): SkillClassification {
  const score = computeDevelopmentalLevelScore(level);
  if (score >= 4) return "strength";
  if (score <= 1 || trend === "needs_attention") return "focus_area";
  return "stable";
}

export async function getTraineeCaseReviewHistory(
  supabase: SupabaseClient,
  traineeId: string,
  opts?: { includeDrafts?: boolean; limit?: number },
): Promise<TrainingCaseReviewRow[]> {
  let q = supabase
    .from("training_case_reviews")
    .select("*")
    .eq("trainee_id", traineeId)
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (!opts?.includeDrafts) {
    q = q.eq("review_status", "submitted");
  }
  if (opts?.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TrainingCaseReviewRow[];
}

export async function fetchSectionsForReviews(
  supabase: SupabaseClient,
  reviewIds: string[],
): Promise<Map<string, TrainingCaseReviewSectionRow[]>> {
  if (!reviewIds.length) return new Map();

  const { data, error } = await supabase
    .from("training_case_review_sections")
    .select("*")
    .in("review_id", reviewIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const map = new Map<string, TrainingCaseReviewSectionRow[]>();
  for (const row of (data ?? []) as TrainingCaseReviewSectionRow[]) {
    const list = map.get(row.review_id) ?? [];
    list.push(row);
    map.set(row.review_id, list);
  }
  return map;
}

export type SkillProgressEntry = {
  key: string;
  title: string;
  sectionKey: string;
  currentLevel: string | null;
  currentLevelLabel: string | null;
  trend: SkillTrendLabel;
  classification: SkillClassification;
  latestNote: string | null;
  reviewCount: number;
};

export function getTraineeSkillProgressSummary(input: {
  reviewsNewestFirst: TrainingCaseReviewRow[];
  sectionsByReviewId: Map<string, TrainingCaseReviewSectionRow[]>;
}): SkillProgressEntry[] {
  const { reviewsNewestFirst, sectionsByReviewId } = input;
  const submitted = reviewsNewestFirst.filter((r) => r.review_status === "submitted");

  return SURGICAL_SKILL_DOMAINS.map((domain) => {
    const levels: (string | null)[] = [];
    let latestNote: string | null = null;

    for (const review of submitted) {
      const sections = sectionsByReviewId.get(review.id) ?? [];
      const section = sections.find((s) => s.section_key === domain.sectionKey);
      if (!section) continue;
      levels.push(section.developmental_level);
      if (!latestNote) {
        latestNote =
          section.faculty_note?.trim() ||
          section.what_went_well?.trim() ||
          section.needs_improvement?.trim() ||
          null;
      }
    }

    const currentLevel = levels[0] ?? null;
    const previousLevel = levels[1] ?? null;
    const trend = computeSkillTrend(currentLevel, previousLevel, levels.filter(Boolean).length);

    return {
      key: domain.key,
      title: domain.title,
      sectionKey: domain.sectionKey,
      currentLevel,
      currentLevelLabel: developmentalLevelLabel(currentLevel),
      trend,
      classification: classifySkill(currentLevel, trend),
      latestNote,
      reviewCount: levels.filter(Boolean).length,
    };
  });
}

function normalizeTheme(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function countThemes(items: string[]): Map<string, { label: string; count: number }> {
  const map = new Map<string, { label: string; count: number }>();
  for (const raw of items) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = normalizeTheme(trimmed);
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { label: trimmed, count: 1 });
  }
  return map;
}

export function getCurrentStrengths(input: {
  latestReview: TrainingCaseReviewRow | null;
  reviewsNewestFirst: TrainingCaseReviewRow[];
  sectionsByReviewId: Map<string, TrainingCaseReviewSectionRow[]>;
  limit?: number;
}): string[] {
  const limit = input.limit ?? 5;
  const themes: string[] = [];

  if (input.latestReview?.main_strengths?.length) {
    themes.push(...input.latestReview.main_strengths);
  }

  const submitted = input.reviewsNewestFirst.filter((r) => r.review_status === "submitted");
  for (const review of submitted.slice(0, 5)) {
    const sections = input.sectionsByReviewId.get(review.id) ?? [];
    for (const s of sections) {
      const score = computeDevelopmentalLevelScore(s.developmental_level);
      if (score >= 4 && s.what_went_well?.trim()) {
        themes.push(s.what_went_well.trim());
      } else if (score >= 4) {
        const def = TRAINING_CASE_REVIEW_SECTIONS.find((d) => d.key === s.section_key);
        if (def) themes.push(def.title);
      }
    }
  }

  const ranked = [...countThemes(themes).values()].sort((a, b) => b.count - a.count);
  return ranked.slice(0, limit).map((r) => r.label);
}

export function getRepeatedFocusAreas(input: {
  reviewsNewestFirst: TrainingCaseReviewRow[];
  sectionsByReviewId: Map<string, TrainingCaseReviewSectionRow[]>;
  limit?: number;
}): string[] {
  const limit = input.limit ?? 5;
  const themes: string[] = [];
  const submitted = input.reviewsNewestFirst.filter((r) => r.review_status === "submitted");

  for (const review of submitted) {
    if (review.improvement_priorities?.length) themes.push(...review.improvement_priorities);
    const sections = input.sectionsByReviewId.get(review.id) ?? [];
    for (const s of sections) {
      const score = computeDevelopmentalLevelScore(s.developmental_level);
      if (score <= 2) {
        if (s.needs_improvement?.trim()) themes.push(s.needs_improvement.trim());
        else if (s.next_case_focus?.trim()) themes.push(s.next_case_focus.trim());
        else {
          const def = TRAINING_CASE_REVIEW_SECTIONS.find((d) => d.key === s.section_key);
          if (def) themes.push(def.title);
        }
      }
    }
  }

  const ranked = [...countThemes(themes).values()]
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count);
  return ranked.slice(0, limit).map((r) => r.label);
}

export function getRecommendedNextFocus(input: {
  latestReview: TrainingCaseReviewRow | null;
  repeatedFocusAreas: string[];
  limit?: number;
}): string[] {
  const limit = input.limit ?? 4;
  const out: string[] = [];

  if (input.latestReview?.recommended_next_focus?.trim()) {
    out.push(input.latestReview.recommended_next_focus.trim());
  }
  if (input.latestReview?.improvement_priorities?.length) {
    out.push(...input.latestReview.improvement_priorities);
  }
  for (const item of input.repeatedFocusAreas) {
    if (!out.some((x) => normalizeTheme(x) === normalizeTheme(item))) out.push(item);
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of out) {
    const key = normalizeTheme(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item.trim());
  }
  return deduped.slice(0, limit);
}

export type TimelineEntry = {
  reviewId: string;
  caseId: string | null;
  caseDate: string | null;
  caseType: string | null;
  caseDifficulty: string | null;
  overallLevel: string | null;
  overallLevelLabel: string | null;
  topStrength: string | null;
  topImprovementPriority: string | null;
  submittedAt: string | null;
};

export function buildCaseReviewTimeline(input: {
  reviewsNewestFirst: TrainingCaseReviewRow[];
}): TimelineEntry[] {
  return input.reviewsNewestFirst
    .filter((r) => r.review_status === "submitted")
    .map((r) => ({
      reviewId: r.id,
      caseId: r.training_case_id,
      caseDate: r.case_date,
      caseType: r.case_type,
      caseDifficulty: r.case_difficulty,
      overallLevel: r.overall_level,
      overallLevelLabel: developmentalLevelLabel(r.overall_level),
      topStrength: r.main_strengths?.[0] ?? null,
      topImprovementPriority: r.improvement_priorities?.[0] ?? null,
      submittedAt: r.submitted_at,
    }));
}

export type ImprovementTrendSummary = {
  hasEnoughData: boolean;
  improvedSkills: string[];
  consistentSkills: string[];
  repeatedFocusSkills: string[];
  biggestPositiveMovement: { skill: string; from: string; to: string } | null;
  facultyRecommendedNextStep: string | null;
};

export function buildImprovementTrendSummary(input: {
  skillProgress: SkillProgressEntry[];
  latestReview: TrainingCaseReviewRow | null;
  reviewsNewestFirst: TrainingCaseReviewRow[];
  sectionsByReviewId: Map<string, TrainingCaseReviewSectionRow[]>;
}): ImprovementTrendSummary {
  const submitted = input.reviewsNewestFirst.filter((r) => r.review_status === "submitted");
  if (submitted.length < 2) {
    return {
      hasEnoughData: false,
      improvedSkills: [],
      consistentSkills: [],
      repeatedFocusSkills: [],
      biggestPositiveMovement: null,
      facultyRecommendedNextStep: input.latestReview?.recommended_next_focus?.trim() ?? null,
    };
  }

  const improvedSkills = input.skillProgress
    .filter((s) => s.trend === "improving")
    .map((s) => s.title);
  const consistentSkills = input.skillProgress
    .filter((s) => s.trend === "stable" && s.reviewCount >= 2)
    .map((s) => s.title);
  const repeatedFocusSkills = input.skillProgress
    .filter((s) => s.trend === "needs_attention" || s.classification === "focus_area")
    .map((s) => s.title);

  let biggestPositiveMovement: ImprovementTrendSummary["biggestPositiveMovement"] = null;
  let maxDelta = 0;

  const latest = submitted[0]!;
  const previous = submitted[1]!;
  const latestSections = input.sectionsByReviewId.get(latest.id) ?? [];
  const prevSections = input.sectionsByReviewId.get(previous.id) ?? [];

  for (const domain of SURGICAL_SKILL_DOMAINS) {
    const cur = latestSections.find((s) => s.section_key === domain.sectionKey);
    const prev = prevSections.find((s) => s.section_key === domain.sectionKey);
    const curScore = computeDevelopmentalLevelScore(cur?.developmental_level);
    const prevScore = computeDevelopmentalLevelScore(prev?.developmental_level);
    const delta = curScore - prevScore;
    if (delta > maxDelta && cur?.developmental_level && prev?.developmental_level) {
      maxDelta = delta;
      biggestPositiveMovement = {
        skill: domain.title,
        from: developmentalLevelLabel(prev.developmental_level) ?? prev.developmental_level,
        to: developmentalLevelLabel(cur.developmental_level) ?? cur.developmental_level,
      };
    }
  }

  return {
    hasEnoughData: true,
    improvedSkills,
    consistentSkills,
    repeatedFocusSkills,
    biggestPositiveMovement,
    facultyRecommendedNextStep: input.latestReview?.recommended_next_focus?.trim() ?? null,
  };
}

export function buildEncouragingSummary(input: {
  latestReview: TrainingCaseReviewRow | null;
  skillProgress: SkillProgressEntry[];
  recommendedNextFocus: string[];
}): string {
  if (!input.latestReview) {
    return "Your surgical progress dashboard will populate as faculty submit Training Case Reviews on your supervised cases.";
  }

  const strengths = input.skillProgress.filter((s) => s.classification === "strength").slice(0, 2);
  const focus = input.recommendedNextFocus[0];

  const parts: string[] = [];
  if (input.latestReview.summary?.trim()) {
    parts.push(input.latestReview.summary.trim());
  } else if (strengths.length) {
    parts.push(
      `Your latest case review shows developing consistency in ${strengths.map((s) => s.title.toLowerCase()).join(" and ")}.`,
    );
  } else {
    parts.push("Your latest case review is on file — keep building supervised case volume with faculty guidance.");
  }

  if (focus) {
    parts.push(`Your next focus: ${focus}.`);
  }

  return parts.join(" ");
}

export type FacultyReadinessSignal = {
  showSignOffConsideration: boolean;
  message: string;
  repeatedStrengths: string[];
  repeatedConcerns: string[];
  submittedReviewCount: number;
  averageOverallScore: number | null;
};

export function buildFacultyReadinessSignal(input: {
  reviewsNewestFirst: TrainingCaseReviewRow[];
  skillProgress: SkillProgressEntry[];
  currentStrengths: string[];
  repeatedFocusAreas: string[];
}): FacultyReadinessSignal {
  const submitted = input.reviewsNewestFirst.filter((r) => r.review_status === "submitted");
  const scores = submitted
    .map((r) => computeDevelopmentalLevelScore(r.overall_level))
    .filter((s) => s > 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const strongSkills = input.skillProgress.filter((s) => s.classification === "strength");
  const focusSkills = input.skillProgress.filter((s) => s.classification === "focus_area");

  const showSignOffConsideration =
    submitted.length >= 3 &&
    avg != null &&
    avg >= 3.5 &&
    focusSkills.length <= 2 &&
    strongSkills.length >= 4;

  let message = "Continue structured case reviews to build a fuller development picture.";
  if (showSignOffConsideration) {
    message =
      "Potentially ready for faculty sign-off review — recent submitted reviews show consistent training-stage performance across multiple domains. Formal sign-off remains at faculty discretion.";
  } else if (submitted.length >= 2 && focusSkills.length > 3) {
    message =
      "Several domains would benefit from repeated supervised focus before sign-off consideration.";
  } else if (submitted.length === 1) {
    message = "First submitted review on file — additional case reviews will clarify trends.";
  }

  return {
    showSignOffConsideration,
    message,
    repeatedStrengths: input.currentStrengths.slice(0, 5),
    repeatedConcerns: input.repeatedFocusAreas.slice(0, 5),
    submittedReviewCount: submitted.length,
    averageOverallScore: avg,
  };
}
