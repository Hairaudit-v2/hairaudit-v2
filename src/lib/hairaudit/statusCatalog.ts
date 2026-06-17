/**
 * Central inventory of status / enum values confirmed from migrations, SQL CHECK constraints,
 * and application usage. Do not add values here without a repo source (migration, test, or typed constant).
 *
 * Phase 1A schema foundation — not a generated Supabase enum mirror.
 */

// ---------------------------------------------------------------------------
// Forensic `cases.status` (TEXT, no DB CHECK — app-enforced)
// ---------------------------------------------------------------------------

/** Primary workflow and pipeline values written to `cases.status`. */
export const CASE_STATUSES = [
  "draft",
  "submitted",
  "processing",
  "complete",
  "audit_failed",
  "failed",
  "evidence_preparing",
  "evidence_ready",
  "audit_running",
  "audit_complete",
  "pdf_pending",
  "pdf_ready",
  "clinic_request_pending",
  "clinic_request_sent",
  "clinic_viewed_request",
  "doctor_contribution_received",
  "benchmark_recalculated",
  "benchmark_eligible",
  "request_closed",
  "request_expired",
  "in_review",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

/**
 * Statuses that imply the patient submit path succeeded (or legacy equivalent) when
 * `submitted_at` is missing. Used by post-op guide and submit CTA logic.
 */
export const CASE_STATUS_IMPLYING_SUBMIT = [
  "submitted",
  "processing",
  "complete",
  "audit_failed",
  "evidence_preparing",
  "evidence_ready",
  "audit_running",
  "audit_complete",
  "pdf_pending",
  "pdf_ready",
  "failed",
  "clinic_request_sent",
  "clinic_request_pending",
  "clinic_viewed_request",
  "doctor_contribution_received",
  "benchmark_recalculated",
  "benchmark_eligible",
  "request_closed",
  "request_expired",
  "in_review",
] as const;

export const CASE_STATUS_IMPLYING_SUBMIT_SET = new Set<string>(CASE_STATUS_IMPLYING_SUBMIT);

/** Bulk intake column on `cases` — migration 20260526120001. */
export const CASE_INTAKE_STATUSES = ["draft", "incomplete", "ready_for_audit"] as const;

export type CaseIntakeStatus = (typeof CASE_INTAKE_STATUSES)[number];

// ---------------------------------------------------------------------------
// `reports.status` (TEXT, default 'complete' — migration 20250210000004)
// ---------------------------------------------------------------------------

/** Values attempted by Inngest `setReportPipelineStatus` (with fallbacks to processing/complete/failed). */
export const REPORT_PIPELINE_PHASE_STATUSES = [
  "processing",
  "evidence_preparing",
  "evidence_ready",
  "audit_running",
  "audit_complete",
  "pdf_pending",
  "pdf_ready",
  "audit_failed",
  "failed",
] as const;

export type ReportPipelinePhaseStatus = (typeof REPORT_PIPELINE_PHASE_STATUSES)[number];

/** Observed stored values including migration default and pipeline fallbacks. */
export const REPORT_STATUSES = [
  "complete",
  "processing",
  "failed",
  ...REPORT_PIPELINE_PHASE_STATUSES,
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

// ---------------------------------------------------------------------------
// `reports.auditor_review_*` — migration 20260309000005
// ---------------------------------------------------------------------------

export const AUDITOR_REVIEW_ELIGIBILITY_VALUES = [
  "not_eligible",
  "eligible_low_score",
  "eligible_high_score",
  "eligible_manual_unlock",
] as const;

export const AUDITOR_REVIEW_STATUS_VALUES = [
  "not_requested",
  "available",
  "in_review",
  "completed",
  "skipped",
] as const;

export const AUDITOR_REVIEW_REASON_VALUES = [
  "low_score_extreme",
  "high_score_extreme",
  "manual_admin_unlock",
] as const;

// ---------------------------------------------------------------------------
// `reports.provisional_status` — migration 20260309000006
// ---------------------------------------------------------------------------

export const PROVISIONAL_STATUS_VALUES = [
  "none",
  "pending_validation",
  "validated_by_auditor",
  "validated_by_evidence",
  "validated_by_consistency",
  "rejected",
] as const;

// ---------------------------------------------------------------------------
// `case_evidence_manifests.status` — migration 20260308000002
// ---------------------------------------------------------------------------

export const CASE_EVIDENCE_MANIFEST_STATUSES = ["processing", "ready", "failed"] as const;

// ---------------------------------------------------------------------------
// `upload_audit_corrections.action` — migration 20260322000001
// ---------------------------------------------------------------------------

export const UPLOAD_AUDIT_CORRECTION_ACTIONS = ["reassign", "rename", "exclude", "restore"] as const;

// ---------------------------------------------------------------------------
// `doctor_cases.status` — Postgres ENUM doctor_case_status (20260314000001)
// ---------------------------------------------------------------------------

export const DOCTOR_CASE_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "needs_input",
  "completed",
  "archived",
] as const;

export type DoctorCaseStatus = (typeof DOCTOR_CASE_STATUSES)[number];

/** `doctor_case_uploads.upload_state` CHECK — migration 20260314000001. */
export const DOCTOR_CASE_UPLOAD_STATES = ["uploaded", "processing", "ready", "failed"] as const;

// ---------------------------------------------------------------------------
// `training_cases.status` — migrations 20260401120001, 20260520120001
// ---------------------------------------------------------------------------

export const TRAINING_CASE_STATUSES = ["draft", "in_review", "reviewed", "archived", "voided"] as const;

export type TrainingCaseStatus = (typeof TRAINING_CASE_STATUSES)[number];

// ---------------------------------------------------------------------------
// `community_cases` — no status column; publication flag only (20260313000002)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// `surgery_upload_details` — migration 20260604000001, 20260604000006
// ---------------------------------------------------------------------------

export const SURGERY_UPLOAD_DETAIL_STATUSES = ["draft", "submitted"] as const;

export const SURGERY_UPLOAD_EVIDENCE_REVIEW_STATUSES = [
  "not_reviewed",
  "in_review",
  "needs_more_evidence",
  "evidence_accepted",
  "ready_for_audit",
] as const;

export const SURGERY_UPLOAD_SLOT_REVIEW_STATUSES = [
  "not_reviewed",
  "accepted",
  "needs_more_photos",
  "poor_quality",
  "not_applicable",
] as const;

// ---------------------------------------------------------------------------
// `case_contribution_requests.status` — migration 20260309000002
// ---------------------------------------------------------------------------

export const CONTRIBUTION_REQUEST_STATUSES = [
  "clinic_request_pending",
  "clinic_request_sent",
  "clinic_viewed_request",
  "doctor_contribution_started",
  "doctor_contribution_received",
  "benchmark_recalculated",
  "benchmark_eligible",
] as const;

/** App-layer terminal contribution / case overlay statuses (also on `cases.status`). */
export const CONTRIBUTION_TERMINAL_CASE_STATUSES = ["request_closed", "request_expired"] as const;

// ---------------------------------------------------------------------------
// `profiles.role` — migration 20250210000001 / 20260313000004
// ---------------------------------------------------------------------------

export const PROFILE_ROLES = ["patient", "doctor", "clinic", "auditor"] as const;

export type ProfileRole = (typeof PROFILE_ROLES)[number];

// ---------------------------------------------------------------------------
// Clinic / doctor profile participation — migrations 20260309000002, 20260318000002
// ---------------------------------------------------------------------------

export const PARTICIPATION_STATUSES = ["not_started", "invited", "active", "high_transparency"] as const;

export const PARTICIPATION_APPROVAL_STATUSES = [
  "not_started",
  "pending_review",
  "approved",
  "more_info_required",
] as const;

export const AWARD_TIER_VALUES = ["VERIFIED", "SILVER", "GOLD", "PLATINUM"] as const;
