/**
 * HA-PHOTO-TIMELINE-2A — Canonical photo session types.
 * `current` is a derived view over the latest follow-up session, never a milestone.
 */

export const PHOTO_SESSION_MILESTONES = [
  "pre_surgery",
  "surgery_day",
  "early_recovery",
  "month_1",
  "month_3",
  "month_6",
  "month_9",
  "month_12",
  "month_18",
  "long_term",
  "unknown",
] as const;

export type PhotoSessionMilestone = (typeof PHOTO_SESSION_MILESTONES)[number];

export const PHOTO_SESSION_MILESTONE_SOURCES = [
  "derived",
  "patient",
  "clinician",
  "legacy_category",
  "needs_review",
] as const;

export type PhotoSessionMilestoneSource = (typeof PHOTO_SESSION_MILESTONE_SOURCES)[number];

export const PHOTO_SESSION_SOURCES = [
  "patient_upload",
  "auditor",
  "clinic",
  "reconciliation",
  "guided_capture",
] as const;

export type PhotoSessionSource = (typeof PHOTO_SESSION_SOURCES)[number];

export const PHOTO_SESSION_STATUSES = [
  "active",
  "needs_review",
  "merged",
  "split",
  "superseded",
] as const;

export type PhotoSessionStatus = (typeof PHOTO_SESSION_STATUSES)[number];

export const PHOTO_SESSION_IMAGE_ROLES = [
  "front",
  "top",
  "crown",
  "left",
  "right",
  "donor_rear",
  "recipient_closeup",
  "donor_closeup",
  "other",
  "unknown",
] as const;

export type PhotoSessionImageRole = (typeof PHOTO_SESSION_IMAGE_ROLES)[number];

export const PHOTO_SESSION_QUALITY_STATUSES = ["ok", "low", "unusable", "unknown"] as const;

export type PhotoSessionQualityStatus = (typeof PHOTO_SESSION_QUALITY_STATUSES)[number];

export type PhotoSession = {
  id: string;
  caseId: string;
  capturedAt: string | null;
  uploadedAt: string;
  relativeDay: number | null;
  milestone: PhotoSessionMilestone;
  milestoneSource: PhotoSessionMilestoneSource;
  milestoneConfidence: number;
  patientConfirmedAt: string | null;
  clinicianConfirmedAt: string | null;
  source: PhotoSessionSource;
  status: PhotoSessionStatus;
  mergedIntoSessionId?: string | null;
};

export type PhotoSessionImage = {
  id: string;
  photoSessionId: string;
  uploadId: string;
  detectedRole: PhotoSessionImageRole;
  confirmedRole: PhotoSessionImageRole | null;
  roleConfidence: number | null;
  qualityStatus: PhotoSessionQualityStatus;
  isCanonicalForRole: boolean;
  excludedAt: string | null;
};

export type PhotoSessionSummary = {
  id: string;
  caseId: string;
  milestone: PhotoSessionMilestone;
  capturedAt: string | null;
  uploadedAt: string;
  relativeDay: number | null;
  milestoneSource: PhotoSessionMilestoneSource;
  milestoneConfidence: number;
  status: PhotoSessionStatus;
  /** Effective roles present (confirmed, else detected), excluding excluded images. */
  rolesPresent: PhotoSessionImageRole[];
  imageCount: number;
};

export type AuditEvidenceLimitationCode =
  | "early_outcome_follow_up"
  | "missing_optional_role"
  | "missing_optional_milestone"
  | "no_distinct_baseline_session"
  | "surgery_day_without_outcome"
  | "low_milestone_confidence"
  | "needs_review_session"
  | "procedure_date_unknown";

export type AuditEvidenceLimitation = {
  code: AuditEvidenceLimitationCode;
  message: string;
  sessionId?: string;
  role?: PhotoSessionImageRole;
  milestone?: PhotoSessionMilestone;
};

export type AuditEvidenceRequirementCode =
  | "baseline_session"
  | "baseline_core_roles"
  | "follow_up_session"
  | "follow_up_core_roles"
  | "any_eligible_postop_session";

export type AuditEvidenceRequirement = {
  code: AuditEvidenceRequirementCode;
  message: string;
  roles?: PhotoSessionImageRole[];
};

export type AuditEvidenceReadiness = "ready" | "ready_with_limitations" | "not_ready";

export type ResolvedAuditEvidenceTimeline = {
  baselineSession: PhotoSessionSummary | null;
  surgeryDaySession: PhotoSessionSummary | null;
  latestFollowUpSession: PhotoSessionSummary | null;
  intermediateSessions: PhotoSessionSummary[];
  recommendedComparison: {
    fromSessionId: string;
    toSessionId: string;
  } | null;
  readiness: AuditEvidenceReadiness;
  limitations: AuditEvidenceLimitation[];
  blockingRequirements: AuditEvidenceRequirement[];
};

/** Patient-safe labels — never expose internal enum names in patient UI. */
export const PATIENT_FACING_MILESTONE_LABELS: Readonly<Record<PhotoSessionMilestone, string>> = {
  pre_surgery: "before surgery",
  surgery_day: "on the day of surgery",
  early_recovery: "in the first weeks after surgery",
  month_1: "around one month after surgery",
  month_3: "around three months after surgery",
  month_6: "around six months after surgery",
  month_9: "around nine months after surgery",
  month_12: "around twelve months after surgery",
  month_18: "around eighteen months after surgery",
  long_term: "more than eighteen months after surgery",
  unknown: "at an unknown time after surgery",
};

export const CORE_BASELINE_ROLES: readonly PhotoSessionImageRole[] = [
  "front",
  "top",
  "donor_rear",
] as const;

/** Follow-up core: front + top + (donor_rear OR crown). */
export const CORE_FOLLOW_UP_FIXED_ROLES: readonly PhotoSessionImageRole[] = [
  "front",
  "top",
] as const;

export const FOLLOW_UP_SUPPORTING_ROLES: readonly PhotoSessionImageRole[] = [
  "donor_rear",
  "crown",
] as const;

export const FOLLOW_UP_MILESTONES: readonly PhotoSessionMilestone[] = [
  "early_recovery",
  "month_1",
  "month_3",
  "month_6",
  "month_9",
  "month_12",
  "month_18",
  "long_term",
] as const;
