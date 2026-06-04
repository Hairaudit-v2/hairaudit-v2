// HairAudit Mobile Surgery Upload Portal — Stage 6C
// Shared (client + server safe) helpers for the audit intake queue. This module
// must stay free of server-only imports so it can be used by the reviewer UI, the
// auditor queue dashboard, and the API routes.
//
// Design / safety notes:
//  * An intake record is a controlled middle layer between evidence review and the
//    future report-generation pipeline. NOTHING here triggers the audit engine.
//  * Only auditors/admins may create or manage intake records. Clinics/doctors can
//    READ status only; patients are excluded by case access. canManageAuditIntake
//    is the single source of truth callers gate write actions on.

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
export const AUDIT_INTAKE_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

export type AuditIntakeStatus = (typeof AUDIT_INTAKE_STATUSES)[number];

export const AUDIT_INTAKE_STATUS_LABELS: Record<AuditIntakeStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const AUDIT_INTAKE_STATUS_SET = new Set<string>(AUDIT_INTAKE_STATUSES);

export function isAuditIntakeStatus(value: unknown): value is AuditIntakeStatus {
  return typeof value === "string" && AUDIT_INTAKE_STATUS_SET.has(value);
}

export function normalizeAuditIntakeStatus(value: unknown): AuditIntakeStatus {
  return isAuditIntakeStatus(value) ? value : "pending";
}

export function auditIntakeStatusLabel(value: unknown): string {
  return AUDIT_INTAKE_STATUS_LABELS[normalizeAuditIntakeStatus(value)];
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------
export const AUDIT_INTAKE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type AuditIntakePriority = (typeof AUDIT_INTAKE_PRIORITIES)[number];

export const AUDIT_INTAKE_PRIORITY_LABELS: Record<AuditIntakePriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const AUDIT_INTAKE_PRIORITY_SET = new Set<string>(AUDIT_INTAKE_PRIORITIES);

export function isAuditIntakePriority(value: unknown): value is AuditIntakePriority {
  return typeof value === "string" && AUDIT_INTAKE_PRIORITY_SET.has(value);
}

export function normalizeAuditIntakePriority(value: unknown): AuditIntakePriority {
  return isAuditIntakePriority(value) ? value : "normal";
}

export function auditIntakePriorityLabel(value: unknown): string {
  return AUDIT_INTAKE_PRIORITY_LABELS[normalizeAuditIntakePriority(value)];
}

/** Default source for records created from the mobile surgery upload flow. */
export const AUDIT_INTAKE_SOURCE = "mobile_surgery_upload";

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------
/** Only auditors/admins may create or manage intake records. */
export function canManageAuditIntake(
  actor: { isAuditor?: boolean } | null | undefined
): boolean {
  return !!actor?.isAuditor;
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------
// Allowed transitions for Stage 6C. Only auditors/admins reach this code, so
// `completed` may be intentionally re-opened (override), but the default flow keeps
// it terminal. A no-op (same status) is always allowed (metadata-only edits).
const ALLOWED_TRANSITIONS: Record<AuditIntakeStatus, AuditIntakeStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["completed", "failed", "cancelled"],
  failed: ["pending", "cancelled"],
  cancelled: ["pending"],
  // Intentional auditor/admin override to re-open a finalized record.
  completed: ["processing"],
};

/** True when `to` is a valid transition from `from` (same status = allowed no-op). */
export function isValidAuditIntakeTransition(
  from: AuditIntakeStatus,
  to: AuditIntakeStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses an auditor can move to from `from` (excludes the current status). */
export function nextAuditIntakeStatuses(from: AuditIntakeStatus): AuditIntakeStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------
/** Raw surgery_upload_audit_intake row shape (server + client). */
export type AuditIntakeRow = {
  id: string;
  case_id: string;
  surgery_upload_details_id: string | null;
  status: AuditIntakeStatus;
  priority: AuditIntakePriority;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  intake_notes: string | null;
  reviewer_notes: string | null;
  source: string;
  metadata: Record<string, unknown> | null;
};

/** Bound for free-text notes stored on an intake record. */
export const MAX_INTAKE_NOTES = 2000;

// ---------------------------------------------------------------------------
// Payload sanitization
// ---------------------------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SanitizedIntakePatch = {
  status?: AuditIntakeStatus;
  priority?: AuditIntakePriority;
  /** undefined = not provided; null = clear assignment; string = set assignment. */
  assignedTo?: string | null;
  intakeNotes?: string | null;
  reviewerNotes?: string | null;
};

function trimNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t.slice(0, MAX_INTAKE_NOTES);
}

/**
 * Validate + coerce a PATCH body into a safe intake patch. Unknown keys are
 * ignored. Returns { patch } with only the keys that were present, or { error }.
 */
export function sanitizeAuditIntakePatch(
  body: Record<string, unknown>
): { patch: SanitizedIntakePatch } | { error: string } {
  const patch: SanitizedIntakePatch = {};

  if ("status" in body && body.status !== undefined) {
    if (!isAuditIntakeStatus(body.status)) return { error: "Invalid status" };
    patch.status = body.status;
  }

  if ("priority" in body && body.priority !== undefined) {
    if (!isAuditIntakePriority(body.priority)) return { error: "Invalid priority" };
    patch.priority = body.priority;
  }

  if ("assignedTo" in body) {
    const raw = body.assignedTo;
    if (raw === null || raw === "") {
      patch.assignedTo = null;
    } else if (typeof raw === "string" && UUID_RE.test(raw)) {
      patch.assignedTo = raw;
    } else {
      return { error: "assignedTo must be a user id or null" };
    }
  }

  if ("intakeNotes" in body) {
    patch.intakeNotes = trimNotes(body.intakeNotes);
  }

  if ("reviewerNotes" in body) {
    patch.reviewerNotes = trimNotes(body.reviewerNotes);
  }

  return { patch };
}

/** Valid intake priority from a create payload, defaulting to "normal". */
export function priorityFromPayload(value: unknown): AuditIntakePriority {
  return isAuditIntakePriority(value) ? value : "normal";
}
