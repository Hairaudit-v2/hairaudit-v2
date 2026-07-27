/**
 * FI-OUTCOME-INTELLIGENCE-1D — Channel-neutral longitudinal reminder events.
 *
 * Consumes canonical 1C milestone state. Does not recalculate schedule/evidence,
 * send notifications, or interpret clinical outcomes.
 */

import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import type {
  LongitudinalCaptureMilestoneStatus,
  LongitudinalCaptureNextActionType,
} from "./longitudinalCaptureTypes";

export const ENGAGEMENT_POLICY_VERSION = "fi-outcome-engagement-v1" as const;
export type EngagementPolicyVersion = typeof ENGAGEMENT_POLICY_VERSION;

export type LongitudinalReminderEventType =
  | "upcoming_window"
  | "capture_due"
  | "evidence_incomplete"
  | "ready_for_review"
  | "late_capture_recovery"
  | "review_available";

export type LongitudinalReminderActionType =
  | "open_capture"
  | "complete_capture"
  | "wait_for_review"
  | "view_review"
  | "wait";

export type LongitudinalReminderSuppressionCode =
  | "MILESTONE_ALREADY_OBSERVED"
  | "REVIEW_ALREADY_VIEWABLE"
  | "STATE_CHANGED"
  | "COOLDOWN_ACTIVE"
  | "MAX_REMINDERS_REACHED"
  | "CHANNEL_NOT_ALLOWED"
  | "EVENT_EXPIRED"
  | "DUPLICATE"
  | "PATIENT_NOT_ELIGIBLE"
  | "INVALID_LINEAGE"
  | "FEATURE_DISABLED"
  | "HISTORICAL_BLAST_BLOCKED"
  | "NOT_YET_ELIGIBLE"
  | "NO_EVENT_TYPE";

export type LongitudinalEngagementEventStatus =
  | "pending"
  | "delivered"
  | "suppressed"
  | "cancelled"
  | "failed";

export type LongitudinalReminderMessageKey =
  | "LONGITUDINAL_UPCOMING_WINDOW"
  | "LONGITUDINAL_CAPTURE_DUE"
  | "LONGITUDINAL_EVIDENCE_INCOMPLETE"
  | "LONGITUDINAL_READY_FOR_REVIEW"
  | "LONGITUDINAL_LATE_CAPTURE_RECOVERY"
  | "LONGITUDINAL_REVIEW_AVAILABLE";

/** Canonical 1C milestone fields required by the engagement decision engine. */
export type CanonicalEngagementMilestoneInput = {
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  stage: LongitudinalOutcomeStage;
  targetDate: string;
  windowStart: string;
  windowEnd: string;
  status: LongitudinalCaptureMilestoneStatus;
  missingRequiredEvidenceRoles: readonly string[];
  /** Patient-safe labels derived from 1C missing roles (not recomputed). */
  missingRequiredLabels: readonly string[];
  observationSnapshotId: string | null;
  reviewAvailable: boolean;
  nextAction: {
    type: LongitudinalCaptureNextActionType;
    href: string | null;
  };
  capturePolicyVersion: string;
  captureProtocolVersion: string;
  /**
   * Optional: when required evidence first became partially present.
   * Used for evidence_incomplete delay. When absent, policy falls back to windowStart.
   */
  evidenceFirstPresentAt?: string | null;
  /** Plan created_at — used to block historical blast by default. */
  planCreatedAt?: string | null;
};

export type LongitudinalReminderAction = {
  type: LongitudinalReminderActionType;
  href: string | null;
};

export type LongitudinalReminderEvent = {
  id: string;
  projectionSnapshotId: string;
  stage: LongitudinalOutcomeStage;
  eventType: LongitudinalReminderEventType;
  reasonCode: string;
  milestoneStatusAtDecision: LongitudinalCaptureMilestoneStatus;
  patientSafeMessageKey: LongitudinalReminderMessageKey;
  action: LongitudinalReminderAction;
  decisionAt: string;
  eligibleAfter: string | null;
  expiresAt: string | null;
  dedupeKey: string;
  policyVersion: EngagementPolicyVersion;
  messageVariables: Record<string, string | number | boolean | null>;
  stateFingerprint: string;
};

export type LongitudinalEngagementEventRecord = {
  id: string;
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  stage: LongitudinalOutcomeStage;
  eventType: LongitudinalReminderEventType;
  reasonCode: string;
  policyVersion: EngagementPolicyVersion;
  dedupeKey: string;
  status: LongitudinalEngagementEventStatus;
  decisionAt: string;
  eligibleAfter: string | null;
  expiresAt: string | null;
  deliveredAt: string | null;
  suppressedAt: string | null;
  suppressionCode: LongitudinalReminderSuppressionCode | null;
  channel: string | null;
  deliveryProviderRef: string | null;
  messageKey: LongitudinalReminderMessageKey;
  messageVariables: Record<string, string | number | boolean | null>;
  stateFingerprint: string;
  milestoneStatusAtDecision: LongitudinalCaptureMilestoneStatus;
  actionType: LongitudinalReminderActionType;
  actionHref: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientLongitudinalEngagementDto = {
  stage: LongitudinalOutcomeStage;
  status: LongitudinalCaptureMilestoneStatus;
  message: string | null;
  action: {
    type:
      | "wait"
      | "upload_followup_images"
      | "complete_followup_images"
      | "wait_for_review"
      | "view_review";
    label: string;
    href: string | null;
  } | null;
};

export type EngagementDecisionResult =
  | {
      ok: true;
      created: boolean;
      reused: boolean;
      suppressed: false;
      event: LongitudinalEngagementEventRecord;
      reminder: LongitudinalReminderEvent;
    }
  | {
      ok: true;
      created: false;
      reused: false;
      suppressed: true;
      suppressionCode: LongitudinalReminderSuppressionCode;
      reason: string;
      event: LongitudinalEngagementEventRecord | null;
    }
  | {
      ok: false;
      code: LongitudinalReminderSuppressionCode;
      reason: string;
    };

export type RevalidationResult =
  | { ok: true; stillValid: true; event: LongitudinalEngagementEventRecord }
  | {
      ok: true;
      stillValid: false;
      suppressionCode: LongitudinalReminderSuppressionCode;
      event: LongitudinalEngagementEventRecord;
    };

export type EngagementBatchHealth = {
  eligibleMilestones: number;
  eventsCreated: number;
  eventsReused: number;
  eventsSuppressed: number;
  deliveryReady: number;
  delivered: number;
  failed: number;
  byEventType: Partial<Record<LongitudinalReminderEventType, number>>;
  byStage: Partial<Record<LongitudinalOutcomeStage, number>>;
};

export type LongitudinalEngagementAuditEventType =
  | "LONGITUDINAL_REMINDER_DECIDED"
  | "LONGITUDINAL_REMINDER_SUPPRESSED"
  | "LONGITUDINAL_REMINDER_DELIVERED"
  | "LONGITUDINAL_REMINDER_FAILED";

export type LongitudinalEngagementAuditEvent = {
  type: LongitudinalEngagementAuditEventType;
  at: string;
  projectionSnapshotId: string;
  stage: LongitudinalOutcomeStage;
  eventType: LongitudinalReminderEventType | null;
  suppressionCode: LongitudinalReminderSuppressionCode | null;
  policyVersion: EngagementPolicyVersion;
};
