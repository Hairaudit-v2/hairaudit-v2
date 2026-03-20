/**
 * Operational, non-blocking reminder hints for coordinators — derived from follow-up timeline.
 * Does not send messages, change scoring, canSubmit, or required uploads.
 */

import {
  FOLLOWUP_TIMELINE_STAGE_ORDER,
  followupTimelineStageLabel,
  type FollowupTimelineResult,
  type FollowupTimelineStageId,
} from "@/lib/audit/followupTimelineFromPatientUploads";

/** Approximate months post-op after which a milestone is typically relevant if still missing */
const STAGE_TYPICAL_START_MONTH: Record<FollowupTimelineStageId, number> = {
  day1: 0,
  week1: 0.25,
  month3: 2.75,
  month6: 5.75,
  month9: 8.75,
  month12: 11.75,
};

export type FollowupReminderReadiness = {
  /** First timeline "recommended" milestone, if any */
  nextRecommendedMilestone: FollowupTimelineStageId | null;
  nextRecommendedLabel: string | null;
  /** True when every milestone has at least one matching patient photo category */
  allMilestonesDocumented: boolean;
  /** Estimated months since procedure from intake (procedure date or months_since bucket); null if unknown */
  monthsPostOpEstimate: number | null;
  /** Milestones missing uploads where calendar estimate suggests the window may have passed */
  milestonesPastWindow: FollowupTimelineStageId[];
  /** Missing milestones within ~1 month before typical window (gentle "due soon") */
  milestonesDueSoon: FollowupTimelineStageId[];
  /** One line per hint; calm, operational wording */
  summaryLines: string[];
  /** Whether timing hints used patient intake (false = timeline-only copy) */
  calendarContextAvailable: boolean;
};

function isStageCompleted(timeline: FollowupTimelineResult, id: FollowupTimelineStageId): boolean {
  const s = timeline.stages.find((x) => x.id === id);
  return !!s && s.matchedCategories.length > 0;
}

/**
 * Combine timeline completion with optional months-since-procedure for soft timing language.
 * `monthsPostOpEstimate` may be null — then only timeline-based "next recommended" is used.
 */
export function buildFollowupReminderReadinessFromTimeline(
  timeline: FollowupTimelineResult,
  options: { monthsPostOpEstimate: number | null }
): FollowupReminderReadiness {
  const months = options.monthsPostOpEstimate;
  const calendarContextAvailable = months != null && Number.isFinite(months);

  const recommended = timeline.stages.find((s) => s.status === "recommended");
  const nextRecommendedMilestone = recommended?.id ?? null;
  const nextRecommendedLabel = recommended ? followupTimelineStageLabel(recommended.id) : null;

  const allMilestonesDocumented = FOLLOWUP_TIMELINE_STAGE_ORDER.every((id) => isStageCompleted(timeline, id));

  const milestonesPastWindow: FollowupTimelineStageId[] = [];
  const milestonesDueSoon: FollowupTimelineStageId[] = [];

  const PAST_SLIP = 0.25;

  if (calendarContextAvailable && months != null) {
    for (const id of FOLLOWUP_TIMELINE_STAGE_ORDER) {
      if (isStageCompleted(timeline, id)) continue;
      const start = STAGE_TYPICAL_START_MONTH[id];
      if (months >= start + PAST_SLIP) {
        milestonesPastWindow.push(id);
      } else if (months >= Math.max(0, start - 0.75) && months < start + PAST_SLIP) {
        milestonesDueSoon.push(id);
      }
    }
  }

  const summaryLines: string[] = [];

  if (allMilestonesDocumented) {
    summaryLines.push(
      "Follow-up photo milestones in the timeline are all represented in patient uploads—no optional coordination prompt from this view."
    );
    return {
      nextRecommendedMilestone: null,
      nextRecommendedLabel: null,
      allMilestonesDocumented: true,
      monthsPostOpEstimate: months,
      milestonesPastWindow,
      milestonesDueSoon,
      summaryLines,
      calendarContextAvailable,
    };
  }

  if (nextRecommendedLabel) {
    summaryLines.push(
      `Next optional documentation touchpoint in sequence: ${nextRecommendedLabel} photography (patient-submitted when they can).`
    );
  }

  if (milestonesPastWindow.length > 0) {
    const labels = milestonesPastWindow.map((id) => followupTimelineStageLabel(id)).join(", ");
    summaryLines.push(
      `Based on estimated time since procedure, ${labels} photos are not yet in the record—consider a gentle patient touchpoint when your workflow allows. HairAudit does not send messages automatically.`
    );
  } else if (milestonesDueSoon.length > 0) {
    const labels = milestonesDueSoon.map((id) => followupTimelineStageLabel(id)).join(", ");
    summaryLines.push(`Follow-up milestone due soon (${labels})—optional reminder when appropriate; not required for audit submission.`);
  }

  if (!calendarContextAvailable && nextRecommendedLabel) {
    summaryLines.push(
      "Add procedure date or time-since-surgery in patient intake for softer timing hints alongside this timeline."
    );
  }

  if (
    !isStageCompleted(timeline, "month12") &&
    calendarContextAvailable &&
    months != null &&
    months >= 12 &&
    !milestonesPastWindow.includes("month12")
  ) {
    summaryLines.push(
      "Long-term outcome documentation would benefit from a 12-month update when the patient can share it—still optional for the audit."
    );
  }

  const deduped = [...new Set(summaryLines)];

  return {
    nextRecommendedMilestone,
    nextRecommendedLabel,
    allMilestonesDocumented: false,
    monthsPostOpEstimate: months,
    milestonesPastWindow,
    milestonesDueSoon,
    summaryLines: deduped.slice(0, 5),
    calendarContextAvailable,
  };
}
