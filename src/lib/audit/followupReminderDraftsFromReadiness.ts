/**
 * Structured reminder drafts from Stage 9 readiness — for manual clinic use only.
 * HairAudit does not send email/SMS from this module.
 */

import type { FollowupReminderReadiness } from "@/lib/audit/followupReminderReadinessFromTimeline";
import {
  followupTimelineStageLabel,
  type FollowupTimelineStageId,
} from "@/lib/audit/followupTimelineFromPatientUploads";

export type FollowupReminderDraftUrgency = "routine_next" | "due_soon" | "past_window";

export type FollowupReminderDraftMetadata = {
  schemaVersion: "hairaudit.followup_reminder_draft.v1";
  milestoneId: FollowupTimelineStageId;
  urgency: FollowupReminderDraftUrgency;
  /** Hints only — no delivery in Stage 10A */
  suggestedChannels: readonly ("email" | "sms")[];
  caseId: string | null;
  generatedAt: string;
};

export type FollowupReminderDraft = {
  milestoneId: FollowupTimelineStageId;
  milestoneLabel: string;
  urgency: FollowupReminderDraftUrgency;
  patientMessageDraft: string;
  coordinatorNote: string;
  metadata: FollowupReminderDraftMetadata;
};

const MAX_DRAFTS = 4;

function urgencyForMilestone(
  id: FollowupTimelineStageId,
  readiness: FollowupReminderReadiness
): FollowupReminderDraftUrgency {
  if (readiness.milestonesPastWindow.includes(id)) return "past_window";
  if (readiness.milestonesDueSoon.includes(id)) return "due_soon";
  return "routine_next";
}

function patientLineForMilestone(id: FollowupTimelineStageId, urgency: FollowupReminderDraftUrgency): string {
  const soft =
    urgency === "past_window"
      ? " Whenever it works for you—there is no requirement for your HairAudit submission."
      : urgency === "due_soon"
        ? " If your schedule allows in the coming weeks, this optional step can help your care team see your progress."
        : " This is completely optional and does not affect submitting your HairAudit.";

  const body: Record<FollowupTimelineStageId, string> = {
    day1:
      "We’re reaching out with a gentle reminder: if you’re able to share clear photos from about the first day after your procedure, they can help document your healing journey in HairAudit.",
    week1:
      "If it’s convenient, optional photos from around the first week after your procedure can add helpful context to your HairAudit record.",
    month3:
      "Around the three-month mark, some patients like to add progress photos to HairAudit so their team can follow density and healing—only if you’d like to.",
    month6:
      "At roughly six months, optional follow-up photos can be a useful snapshot for long-term tracking in HairAudit—entirely your choice.",
    month9:
      "If you’re open to it, optional nine-month progress photos can enrich your HairAudit documentation; no pressure either way.",
    month12:
      "Twelve-month outcome photos are a nice way to round out your HairAudit story when you’re ready—they remain optional.",
  };

  return `${body[id]}${soft}`;
}

function coordinatorNoteForMilestone(
  id: FollowupTimelineStageId,
  urgency: FollowupReminderDraftUrgency,
  readiness: FollowupReminderReadiness
): string {
  const label = followupTimelineStageLabel(id);
  const timing =
    readiness.calendarContextAvailable && readiness.monthsPostOpEstimate != null
      ? ` Estimated ~${Math.round(readiness.monthsPostOpEstimate * 10) / 10} mo post-op from intake.`
      : " Procedure timing not in intake—use your own clinical schedule.";
  const urg =
    urgency === "past_window"
      ? "Timing suggests this window may have passed; offer a soft, optional check-in."
      : urgency === "due_soon"
        ? "Milestone coming up; optional reminder if your workflow allows."
        : "Next logical optional touchpoint in the HairAudit photo sequence.";

  return `[HairAudit draft — do not auto-send] ${label}: ${urg}${timing} No photos in grouped timeline for this milestone yet. Review and send only through your own channels if appropriate.`;
}

function collectTargetMilestones(readiness: FollowupReminderReadiness): FollowupTimelineStageId[] {
  if (readiness.allMilestonesDocumented) return [];

  const out: FollowupTimelineStageId[] = [];
  const push = (id: FollowupTimelineStageId) => {
    if (!out.includes(id)) out.push(id);
  };

  if (readiness.nextRecommendedMilestone) push(readiness.nextRecommendedMilestone);
  for (const id of readiness.milestonesPastWindow) push(id);
  for (const id of readiness.milestonesDueSoon) push(id);

  return out.slice(0, MAX_DRAFTS);
}

export type BuildFollowupReminderDraftsArgs = {
  caseId: string | null;
  /** ISO-8601; caller supplies for auditability */
  generatedAt: string;
};

/**
 * Produce copy-ready drafts for clinic/coordinator use. Empty when every milestone is documented.
 */
export function buildFollowupReminderDraftsFromReadiness(
  readiness: FollowupReminderReadiness,
  args: BuildFollowupReminderDraftsArgs
): FollowupReminderDraft[] {
  const targets = collectTargetMilestones(readiness);
  if (!targets.length) return [];

  const drafts: FollowupReminderDraft[] = [];

  for (const milestoneId of targets) {
    const urgency = urgencyForMilestone(milestoneId, readiness);
    const milestoneLabel = followupTimelineStageLabel(milestoneId);
    drafts.push({
      milestoneId,
      milestoneLabel,
      urgency,
      patientMessageDraft: patientLineForMilestone(milestoneId, urgency),
      coordinatorNote: coordinatorNoteForMilestone(milestoneId, urgency, readiness),
      metadata: {
        schemaVersion: "hairaudit.followup_reminder_draft.v1",
        milestoneId,
        urgency,
        suggestedChannels: ["email", "sms"] as const,
        caseId: args.caseId,
        generatedAt: args.generatedAt,
      },
    });
  }

  return drafts;
}
