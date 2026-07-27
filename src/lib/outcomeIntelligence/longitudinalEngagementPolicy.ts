/**
 * FI-OUTCOME-INTELLIGENCE-1D — Versioned engagement policy (fi-outcome-engagement-v1).
 *
 * Product-engagement timings only — not clinical timing.
 * Do not scatter timing constants outside this module.
 */

import {
  ENGAGEMENT_POLICY_VERSION,
  type EngagementPolicyVersion,
  type LongitudinalReminderEventType,
  type LongitudinalReminderMessageKey,
} from "./longitudinalEngagementTypes";

export type LongitudinalEngagementPolicy = {
  version: EngagementPolicyVersion;
  /** Days before windowStart for upcoming_window. */
  upcomingWindowDaysBeforeStart: number;
  /** Days after first partial evidence before evidence_incomplete. */
  evidenceIncompleteDelayDays: number;
  /** Days after windowEnd for first late_capture_recovery. */
  lateRecoveryFirstDaysAfterEnd: number;
  /** Days after windowEnd for optional second recovery. */
  lateRecoverySecondDaysAfterEnd: number;
  /** Patient-wide cooldown between longitudinal contacts (hours). */
  patientCooldownHours: number;
  /** Max contact reminders per milestone before observation (excludes review_available). */
  maxContactRemindersPerMilestone: number;
  /** Quiet hours (patient local / UTC fallback) for external delivery. */
  quietHoursStartLocal: number;
  quietHoursEndLocal: number;
  messageKeys: Readonly<Record<LongitudinalReminderEventType, LongitudinalReminderMessageKey>>;
  /** Event types that count toward max contact reminders. */
  contactEventTypes: readonly LongitudinalReminderEventType[];
};

export const ENGAGEMENT_POLICY_V1: LongitudinalEngagementPolicy = {
  version: ENGAGEMENT_POLICY_VERSION,
  upcomingWindowDaysBeforeStart: 7,
  evidenceIncompleteDelayDays: 5,
  lateRecoveryFirstDaysAfterEnd: 7,
  lateRecoverySecondDaysAfterEnd: 21,
  patientCooldownHours: 72,
  maxContactRemindersPerMilestone: 3,
  quietHoursStartLocal: 8,
  quietHoursEndLocal: 19,
  messageKeys: {
    upcoming_window: "LONGITUDINAL_UPCOMING_WINDOW",
    capture_due: "LONGITUDINAL_CAPTURE_DUE",
    evidence_incomplete: "LONGITUDINAL_EVIDENCE_INCOMPLETE",
    ready_for_review: "LONGITUDINAL_READY_FOR_REVIEW",
    late_capture_recovery: "LONGITUDINAL_LATE_CAPTURE_RECOVERY",
    review_available: "LONGITUDINAL_REVIEW_AVAILABLE",
  },
  contactEventTypes: [
    "upcoming_window",
    "capture_due",
    "evidence_incomplete",
    "ready_for_review",
    "late_capture_recovery",
  ],
};

export function getEngagementPolicy(
  version: EngagementPolicyVersion = ENGAGEMENT_POLICY_VERSION
): LongitudinalEngagementPolicy {
  if (version !== ENGAGEMENT_POLICY_VERSION) {
    throw new Error(`Unsupported engagement policy version: ${version}`);
  }
  return ENGAGEMENT_POLICY_V1;
}

export function describeEngagementTimingPolicy(
  version: EngagementPolicyVersion = ENGAGEMENT_POLICY_VERSION
): string {
  const p = getEngagementPolicy(version);
  return [
    `policy=${p.version}`,
    `upcoming_window: ${p.upcomingWindowDaysBeforeStart}d before windowStart`,
    `capture_due: on/after windowStart when status=due`,
    `evidence_incomplete: ${p.evidenceIncompleteDelayDays}d after first partial (fallback: windowStart)`,
    `late_capture_recovery: +${p.lateRecoveryFirstDaysAfterEnd}d and +${p.lateRecoverySecondDaysAfterEnd}d after windowEnd`,
    `ready_for_review: once when status=ready_for_review`,
    `review_available: once when observed + reviewAvailable`,
    `cooldown: ${p.patientCooldownHours}h per patient`,
    `max contacts/milestone: ${p.maxContactRemindersPerMilestone}`,
    `quiet hours (external): ${String(p.quietHoursStartLocal).padStart(2, "0")}:00–${String(p.quietHoursEndLocal).padStart(2, "0")}:00`,
  ].join("; ");
}

export function isContactEventType(eventType: LongitudinalReminderEventType): boolean {
  return (ENGAGEMENT_POLICY_V1.contactEventTypes as readonly string[]).includes(
    eventType
  );
}
