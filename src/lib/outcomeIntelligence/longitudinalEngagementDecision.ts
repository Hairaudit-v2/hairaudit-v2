/**
 * FI-OUTCOME-INTELLIGENCE-1D — Pure decision logic over canonical 1C milestones.
 *
 * Injected `now` only. Does not re-run schedule or evidence policy.
 */

import { addCalendarDays, todayUtcDate } from "./longitudinalCaptureSchedule";
import { getEngagementPolicy, isContactEventType } from "./longitudinalEngagementPolicy";
import {
  buildMessageVariables,
  stageLabelForEngagement,
} from "./longitudinalEngagementTemplates";
import {
  ENGAGEMENT_POLICY_VERSION,
  type CanonicalEngagementMilestoneInput,
  type LongitudinalReminderAction,
  type LongitudinalReminderActionType,
  type LongitudinalReminderEvent,
  type LongitudinalReminderEventType,
  type LongitudinalReminderSuppressionCode,
} from "./longitudinalEngagementTypes";

export type EngagementEligibility =
  | {
      eligible: true;
      eventType: LongitudinalReminderEventType;
      reasonCode: string;
      recoveryWave: number | null;
      eligibleAfter: string | null;
      expiresAt: string | null;
    }
  | {
      eligible: false;
      code: LongitudinalReminderSuppressionCode;
      reason: string;
    };

function mapAction(
  input: CanonicalEngagementMilestoneInput,
  eventType: LongitudinalReminderEventType
): LongitudinalReminderAction {
  const href = input.nextAction.href;
  switch (eventType) {
    case "upcoming_window":
      return { type: "wait", href: null };
    case "capture_due":
    case "late_capture_recovery":
      return { type: "open_capture", href };
    case "evidence_incomplete":
      return { type: "complete_capture", href };
    case "ready_for_review":
      return { type: "wait_for_review", href: null };
    case "review_available":
      return { type: "view_review", href };
    default: {
      const _exhaustive: never = eventType;
      return _exhaustive;
    }
  }
}

export function buildStateFingerprint(args: {
  status: string;
  missingRequiredCount: number;
  reviewAvailable: boolean;
  recoveryWave: number | null;
}): string {
  return [
    `status=${args.status}`,
    `missing=${args.missingRequiredCount}`,
    `review=${args.reviewAvailable ? "1" : "0"}`,
    `wave=${args.recoveryWave ?? 0}`,
  ].join("|");
}

export function buildDedupeKey(args: {
  projectionSnapshotId: string;
  stage: string;
  eventType: LongitudinalReminderEventType;
  policyVersion: string;
  stateFingerprint: string;
}): string {
  return [
    args.projectionSnapshotId,
    args.stage,
    args.eventType,
    args.policyVersion,
    args.stateFingerprint,
  ].join("::");
}

/**
 * Choose the single most useful event type for this milestone at `now`.
 * Priority favors actionable capture over quieter operational notices.
 */
export function evaluateEngagementEligibility(
  input: CanonicalEngagementMilestoneInput,
  now: string
): EngagementEligibility {
  const policy = getEngagementPolicy();
  const nowDate = todayUtcDate(now);

  if (!input.projectionSnapshotId || !input.stage) {
    return {
      eligible: false,
      code: "INVALID_LINEAGE",
      reason: "Missing projectionSnapshotId or stage.",
    };
  }

  // Observed + review → review_available (completion event)
  if (input.status === "observed") {
    if (input.reviewAvailable) {
      return {
        eligible: true,
        eventType: "review_available",
        reasonCode: "REVIEW_AVAILABLE",
        recoveryWave: null,
        eligibleAfter: null,
        expiresAt: addCalendarDays(nowDate, 90) + "T23:59:59.000Z",
      };
    }
    return {
      eligible: false,
      code: "MILESTONE_ALREADY_OBSERVED",
      reason: "Milestone observed; review not yet available.",
    };
  }

  if (input.status === "ready_for_review") {
    return {
      eligible: true,
      eventType: "ready_for_review",
      reasonCode: "EVIDENCE_COMPLETE_AWAITING_REVIEW",
      recoveryWave: null,
      eligibleAfter: null,
      expiresAt: addCalendarDays(input.windowEnd, 60) + "T23:59:59.000Z",
    };
  }

  if (input.status === "missed") {
    const firstRecovery = addCalendarDays(
      input.windowEnd,
      policy.lateRecoveryFirstDaysAfterEnd
    );
    const secondRecovery = addCalendarDays(
      input.windowEnd,
      policy.lateRecoverySecondDaysAfterEnd
    );
    if (nowDate >= secondRecovery) {
      return {
        eligible: true,
        eventType: "late_capture_recovery",
        reasonCode: "LATE_RECOVERY_WAVE_2",
        recoveryWave: 2,
        eligibleAfter: secondRecovery + "T00:00:00.000Z",
        expiresAt: addCalendarDays(secondRecovery, 30) + "T23:59:59.000Z",
      };
    }
    if (nowDate >= firstRecovery) {
      return {
        eligible: true,
        eventType: "late_capture_recovery",
        reasonCode: "LATE_RECOVERY_WAVE_1",
        recoveryWave: 1,
        eligibleAfter: firstRecovery + "T00:00:00.000Z",
        expiresAt: secondRecovery + "T00:00:00.000Z",
      };
    }
    return {
      eligible: false,
      code: "NOT_YET_ELIGIBLE",
      reason: `Late recovery not yet due (first at ${firstRecovery}).`,
    };
  }

  if (input.status === "evidence_incomplete") {
    const anchorDate = input.evidenceFirstPresentAt
      ? todayUtcDate(input.evidenceFirstPresentAt)
      : input.windowStart;
    const eligibleDate = addCalendarDays(
      anchorDate,
      policy.evidenceIncompleteDelayDays
    );
    if (nowDate < eligibleDate) {
      return {
        eligible: false,
        code: "NOT_YET_ELIGIBLE",
        reason: `Evidence incomplete delay until ${eligibleDate}.`,
      };
    }
    return {
      eligible: true,
      eventType: "evidence_incomplete",
      reasonCode: "REQUIRED_EVIDENCE_STILL_MISSING",
      recoveryWave: null,
      eligibleAfter: eligibleDate + "T00:00:00.000Z",
      expiresAt: addCalendarDays(input.windowEnd, 14) + "T23:59:59.000Z",
    };
  }

  if (input.status === "due") {
    if (nowDate < input.windowStart) {
      return {
        eligible: false,
        code: "NOT_YET_ELIGIBLE",
        reason: "Due status before windowStart is unexpected; waiting.",
      };
    }
    return {
      eligible: true,
      eventType: "capture_due",
      reasonCode: "CAPTURE_WINDOW_OPEN",
      recoveryWave: null,
      eligibleAfter: input.windowStart + "T00:00:00.000Z",
      expiresAt: input.windowEnd + "T23:59:59.000Z",
    };
  }

  if (input.status === "future") {
    const upcomingStart = addCalendarDays(
      input.windowStart,
      -policy.upcomingWindowDaysBeforeStart
    );
    if (nowDate >= upcomingStart && nowDate < input.windowStart) {
      return {
        eligible: true,
        eventType: "upcoming_window",
        reasonCode: "PRE_WINDOW_HEADS_UP",
        recoveryWave: null,
        eligibleAfter: upcomingStart + "T00:00:00.000Z",
        expiresAt: input.windowStart + "T00:00:00.000Z",
      };
    }
    return {
      eligible: false,
      code: "NOT_YET_ELIGIBLE",
      reason: "Future milestone outside pre-window.",
    };
  }

  return {
    eligible: false,
    code: "NO_EVENT_TYPE",
    reason: `No engagement event for status=${input.status}.`,
  };
}

export function buildReminderEvent(args: {
  id: string;
  input: CanonicalEngagementMilestoneInput;
  eligibility: Extract<EngagementEligibility, { eligible: true }>;
  decisionAt: string;
}): LongitudinalReminderEvent {
  const policy = getEngagementPolicy();
  const missingCount = args.input.missingRequiredEvidenceRoles.length;
  const fingerprint = buildStateFingerprint({
    status: args.input.status,
    missingRequiredCount: missingCount,
    reviewAvailable: args.input.reviewAvailable,
    recoveryWave: args.eligibility.recoveryWave,
  });
  const messageKey = policy.messageKeys[args.eligibility.eventType];
  const variables = buildMessageVariables({
    stage: args.input.stage,
    missingRequiredCount: missingCount,
    missingRequiredLabels: args.input.missingRequiredLabels,
  });

  return {
    id: args.id,
    projectionSnapshotId: args.input.projectionSnapshotId,
    stage: args.input.stage,
    eventType: args.eligibility.eventType,
    reasonCode: args.eligibility.reasonCode,
    milestoneStatusAtDecision: args.input.status,
    patientSafeMessageKey: messageKey,
    action: mapAction(args.input, args.eligibility.eventType),
    decisionAt: args.decisionAt,
    eligibleAfter: args.eligibility.eligibleAfter,
    expiresAt: args.eligibility.expiresAt,
    dedupeKey: buildDedupeKey({
      projectionSnapshotId: args.input.projectionSnapshotId,
      stage: args.input.stage,
      eventType: args.eligibility.eventType,
      policyVersion: ENGAGEMENT_POLICY_VERSION,
      stateFingerprint: fingerprint,
    }),
    policyVersion: ENGAGEMENT_POLICY_VERSION,
    messageVariables: variables,
    stateFingerprint: fingerprint,
  };
}

/**
 * Send-time revalidation against fresh 1C canonical state.
 */
export function revalidateReminderAgainstMilestone(args: {
  eventType: LongitudinalReminderEventType;
  milestoneStatusAtDecision: string;
  expiresAt: string | null;
  current: CanonicalEngagementMilestoneInput;
  now: string;
}): {
  stillValid: boolean;
  suppressionCode: LongitudinalReminderSuppressionCode | null;
  reason: string;
} {
  const nowMs = new Date(args.now).getTime();
  if (args.expiresAt) {
    const exp = new Date(args.expiresAt).getTime();
    if (Number.isFinite(exp) && nowMs > exp) {
      return {
        stillValid: false,
        suppressionCode: "EVENT_EXPIRED",
        reason: "Event past expiresAt.",
      };
    }
  }

  const status = args.current.status;

  if (status === "observed") {
    if (args.eventType === "review_available" && args.current.reviewAvailable) {
      return { stillValid: true, suppressionCode: null, reason: "still valid" };
    }
    if (args.eventType !== "review_available") {
      return {
        stillValid: false,
        suppressionCode: "MILESTONE_ALREADY_OBSERVED",
        reason: "Milestone observed; upload/incomplete reminders stale.",
      };
    }
  }

  if (
    (args.eventType === "capture_due" ||
      args.eventType === "evidence_incomplete" ||
      args.eventType === "upcoming_window" ||
      args.eventType === "late_capture_recovery") &&
    (status === "ready_for_review" || status === "observed")
  ) {
    return {
      stillValid: false,
      suppressionCode:
        status === "observed" ? "MILESTONE_ALREADY_OBSERVED" : "STATE_CHANGED",
      reason: `Status moved to ${status}; suppress upload-oriented reminder.`,
    };
  }

  if (args.eventType === "ready_for_review" && status !== "ready_for_review") {
    if (status === "observed") {
      return {
        stillValid: false,
        suppressionCode: "MILESTONE_ALREADY_OBSERVED",
        reason: "Already observed.",
      };
    }
    return {
      stillValid: false,
      suppressionCode: "STATE_CHANGED",
      reason: `ready_for_review no longer applicable (status=${status}).`,
    };
  }

  if (args.eventType === "review_available") {
    if (!args.current.reviewAvailable || status !== "observed") {
      return {
        stillValid: false,
        suppressionCode: "STATE_CHANGED",
        reason: "Review no longer viewable for this milestone.",
      };
    }
  }

  if (args.eventType === "capture_due" && status !== "due") {
    return {
      stillValid: false,
      suppressionCode: "STATE_CHANGED",
      reason:
        status === "evidence_incomplete"
          ? "Moved to evidence_incomplete; capture_due stale."
          : `capture_due stale (status=${status}).`,
    };
  }

  if (args.eventType === "evidence_incomplete") {
    if (status !== "evidence_incomplete") {
      return {
        stillValid: false,
        suppressionCode: "STATE_CHANGED",
        reason: `evidence_incomplete stale (status=${status}).`,
      };
    }
    // Changed missing count → fingerprint would differ; suppress obsolete text
    const decidedMissing = Number(
      // compared via caller fingerprint when available; here check roles length
      args.current.missingRequiredEvidenceRoles.length
    );
    void decidedMissing;
  }

  if (args.eventType === "upcoming_window" && status !== "future") {
    return {
      stillValid: false,
      suppressionCode: "STATE_CHANGED",
      reason: "Window opened or status changed; upcoming stale.",
    };
  }

  if (args.eventType === "late_capture_recovery" && status !== "missed") {
    if (status === "evidence_incomplete" || status === "due") {
      // Still upload-relevant — allow if still incomplete/missed path
      // but if they uploaded partially, prefer incomplete event; suppress recovery
      return {
        stillValid: false,
        suppressionCode: "STATE_CHANGED",
        reason: `Recovery stale (status=${status}).`,
      };
    }
    return {
      stillValid: false,
      suppressionCode: "STATE_CHANGED",
      reason: `Recovery stale (status=${status}).`,
    };
  }

  return { stillValid: true, suppressionCode: null, reason: "still valid" };
}

export function mapReminderActionToPatientAction(
  actionType: LongitudinalReminderActionType
): PatientActionType {
  switch (actionType) {
    case "wait":
      return "wait";
    case "open_capture":
      return "upload_followup_images";
    case "complete_capture":
      return "complete_followup_images";
    case "wait_for_review":
      return "wait_for_review";
    case "view_review":
      return "view_review";
    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

type PatientActionType =
  | "wait"
  | "upload_followup_images"
  | "complete_followup_images"
  | "wait_for_review"
  | "view_review";

export function patientActionLabel(args: {
  actionType: PatientActionType;
  stage: CanonicalEngagementMilestoneInput["stage"];
}): string {
  const label = stageLabelForEngagement(args.stage);
  switch (args.actionType) {
    case "wait":
      return `Your next HairAudit review is scheduled for your ${label}.`;
    case "upload_followup_images":
      return `Upload your ${label} follow-up photos.`;
    case "complete_followup_images":
      return `Complete your ${label} follow-up photos.`;
    case "wait_for_review":
      return `Your ${label} photos are ready for review.`;
    case "view_review":
      return `View your ${label} review.`;
    default: {
      const _exhaustive: never = args.actionType;
      return _exhaustive;
    }
  }
}

export { isContactEventType };
