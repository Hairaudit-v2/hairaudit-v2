// HairAudit Mobile Surgery Upload Portal — Stage 6B
// Controlled audit-pipeline handoff: shared (client + server safe) helpers for the
// auditor-only "Send to Audit Pipeline" action. This module must stay free of
// server-only imports so it can be used by both the reviewer UI and the API route.
//
// Design / safety notes:
//  * Reaching evidence_review_status = ready_for_audit does NOT make a handoff
//    happen — it only makes one ELIGIBLE. The auditor must explicitly trigger it.
//  * The handoff status is SEPARATE from surgery_upload_details.status,
//    evidence_review_status, and cases.status.
//  * Stage 6B runs in MARKER mode (Option C): the existing audit engine is not
//    invoked. Stage 6C will connect the marker to the real pipeline (direct/queue).

// ---------------------------------------------------------------------------
// Handoff status
// ---------------------------------------------------------------------------
export const AUDIT_HANDOFF_STATUSES = [
  "not_sent",
  "sending",
  "sent",
  "failed",
] as const;

export type AuditHandoffStatus = (typeof AUDIT_HANDOFF_STATUSES)[number];

export const AUDIT_HANDOFF_STATUS_LABELS: Record<AuditHandoffStatus, string> = {
  not_sent: "Not sent to audit",
  sending: "Sending to audit",
  sent: "Sent to audit",
  failed: "Handoff failed",
};

const AUDIT_HANDOFF_STATUS_SET = new Set<string>(AUDIT_HANDOFF_STATUSES);

export function isAuditHandoffStatus(value: unknown): value is AuditHandoffStatus {
  return typeof value === "string" && AUDIT_HANDOFF_STATUS_SET.has(value);
}

/** Normalize an arbitrary stored value to a known handoff status (default not_sent). */
export function normalizeAuditHandoffStatus(value: unknown): AuditHandoffStatus {
  return isAuditHandoffStatus(value) ? value : "not_sent";
}

export function auditHandoffStatusLabel(value: unknown): string {
  return AUDIT_HANDOFF_STATUS_LABELS[normalizeAuditHandoffStatus(value)];
}

/** Statuses that mean a handoff is in-flight or already done (cannot re-trigger). */
export function isAuditHandoffLocked(value: unknown): boolean {
  const s = normalizeAuditHandoffStatus(value);
  return s === "sending" || s === "sent";
}

// ---------------------------------------------------------------------------
// Pipeline mode (documents how this stage connects to the audit engine)
// ---------------------------------------------------------------------------
export type AuditHandoffPipelineMode = "direct" | "queue" | "marker";

/**
 * Stage 6B integration approach. The existing /api/submit + Inngest pipeline is
 * NOT safe to call directly for surgery uploads (it forbids auditors, validates
 * patient/doctor/clinic photo categories, and depends on audit_type semantics
 * surgery uploads lack), and there is no dedicated audit queue table. So Stage 6B
 * records a controlled marker only. Stage 6C should switch this to "direct" or
 * "queue" once a safe integration exists.
 */
export const AUDIT_HANDOFF_PIPELINE_MODE: AuditHandoffPipelineMode = "marker";

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------
/** Only auditors/admins may trigger the handoff. Clinics/doctors never can. */
export function canTriggerAuditHandoff(
  actor: { isAuditor?: boolean } | null | undefined
): boolean {
  return !!actor?.isAuditor;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------
export type AuditHandoffEligibilityInput = {
  /** surgery_upload_details.status */
  status: string | null | undefined;
  /** surgery_upload_details.evidence_review_status */
  evidenceReviewStatus: string | null | undefined;
  /** surgery_upload_details.audit_handoff_status */
  auditHandoffStatus: string | null | undefined;
  /** True when every required slot meets its minCount (Stage 3.1 server check). */
  requiredEvidenceComplete: boolean;
};

export type AuditHandoffCheckKey =
  | "submitted"
  | "ready_for_audit"
  | "required_complete"
  | "not_already_sent";

export type AuditHandoffChecklistItem = {
  key: AuditHandoffCheckKey;
  label: string;
  ok: boolean;
};

export type AuditHandoffEligibility = {
  eligible: boolean;
  checklist: AuditHandoffChecklistItem[];
  /** First failing reason, ready for a 4xx response / UI message. */
  reason: string | null;
};

const CHECK_FAIL_REASON: Record<AuditHandoffCheckKey, string> = {
  submitted: "The surgery upload must be submitted before it can be handed off.",
  ready_for_audit:
    "Evidence must be reviewed and marked Ready for audit before handoff.",
  required_complete:
    "Required evidence is incomplete. Resolve the missing photo minimums first.",
  not_already_sent: "This upload has already been sent (or is being sent) to audit.",
};

/**
 * Pure eligibility evaluation shared by the API route (authoritative) and the
 * reviewer UI (mirroring). Does NOT consider the actor role — callers gate the
 * action on canTriggerAuditHandoff separately.
 */
export function computeAuditHandoffEligibility(
  input: AuditHandoffEligibilityInput
): AuditHandoffEligibility {
  const checklist: AuditHandoffChecklistItem[] = [
    {
      key: "submitted",
      label: "Submitted upload",
      ok: input.status === "submitted",
    },
    {
      key: "ready_for_audit",
      label: "Evidence marked ready for audit",
      ok: input.evidenceReviewStatus === "ready_for_audit",
    },
    {
      key: "required_complete",
      label: "Required evidence complete",
      ok: input.requiredEvidenceComplete,
    },
    {
      key: "not_already_sent",
      label: "Not already sent",
      ok: !isAuditHandoffLocked(input.auditHandoffStatus),
    },
  ];

  const firstFail = checklist.find((c) => !c.ok);
  return {
    eligible: !firstFail,
    checklist,
    reason: firstFail ? CHECK_FAIL_REASON[firstFail.key] : null,
  };
}
