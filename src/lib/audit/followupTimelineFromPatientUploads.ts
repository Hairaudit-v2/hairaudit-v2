/**
 * Informational follow-up milestones from patient_photo uploads only.
 * Does not affect scoring, canSubmit, or required uploads.
 */

import { storageCategoryKeyFromPatientUploadType } from "@/lib/audit/patientAiImageEvidence";

export type FollowupTimelineStageId = "day1" | "week1" | "month3" | "month6" | "month9" | "month12";

export type FollowupTimelineStatus = "completed" | "recommended" | "upcoming";

export type FollowupTimelineStage = {
  id: FollowupTimelineStageId;
  label: string;
  status: FollowupTimelineStatus;
  /** Resolved patient photo categories contributing to this stage */
  matchedCategories: string[];
};

export type FollowupTimelineResult = {
  stages: FollowupTimelineStage[];
};

const STAGE_ORDER: readonly FollowupTimelineStageId[] = [
  "day1",
  "week1",
  "month3",
  "month6",
  "month9",
  "month12",
] as const;

const STAGE_LABEL: Record<FollowupTimelineStageId, string> = {
  day1: "Day 1",
  week1: "Week 1",
  month3: "Month 3",
  month6: "Month 6",
  month9: "Month 9",
  month12: "Month 12",
};

function categoryMatchesStage(cat: string, stage: FollowupTimelineStageId): boolean {
  switch (stage) {
    case "day1":
      return (
        cat === "postop_day1_recipient" ||
        cat === "postop_day1_donor" ||
        cat === "day0_recipient" ||
        cat.startsWith("day0_donor")
      );
    case "week1":
      return cat === "postop_week1_recipient" || cat === "postop_week1_donor";
    case "month3":
      return cat.startsWith("postop_month3_");
    case "month6":
      return cat.startsWith("postop_month6_");
    case "month9":
      return cat.startsWith("postop_month9_");
    case "month12":
      return cat.startsWith("postop_month12_");
    default:
      return false;
  }
}

function collectPatientPhotoCategories(uploads: Array<{ type?: string | null }>): string[] {
  const cats: string[] = [];
  for (const u of uploads) {
    const t = String(u.type ?? "");
    const cat = storageCategoryKeyFromPatientUploadType(t);
    if (cat) cats.push(cat);
  }
  return cats;
}

function stageCompletion(stage: FollowupTimelineStageId, categories: readonly string[]): string[] {
  const matched = categories.filter((c) => categoryMatchesStage(c, stage));
  return [...new Set(matched)];
}

/**
 * Map patient uploads to ordered milestones with completed / recommended / upcoming.
 * First gap in chronological order is **recommended**; earlier incomplete stages are still **recommended**
 * if they are the first missing milestone (linear fill).
 */
export function buildFollowupTimelineFromPatientUploads(
  uploads: Array<{ type?: string | null }>
): FollowupTimelineResult {
  const categories = collectPatientPhotoCategories(uploads);
  const completedFlags = STAGE_ORDER.map((id) => {
    const matched = stageCompletion(id, categories);
    return { id, matched, has: matched.length > 0 };
  });

  const firstGap = completedFlags.findIndex((x) => !x.has);

  const stages: FollowupTimelineStage[] = completedFlags.map((x, i) => {
    let status: FollowupTimelineStatus;
    if (x.has) {
      status = "completed";
    } else if (firstGap === -1) {
      status = "completed";
    } else if (i === firstGap) {
      status = "recommended";
    } else {
      status = "upcoming";
    }

    return {
      id: x.id,
      label: STAGE_LABEL[x.id],
      status,
      matchedCategories: x.matched,
    };
  });

  return { stages };
}
