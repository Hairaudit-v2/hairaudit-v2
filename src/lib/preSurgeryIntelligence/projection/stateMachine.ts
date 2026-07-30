/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Projection generation lifecycle state machine.
 */

import type { PreSurgeryProjectionStatus } from "../types";

/** All states in the controlled lifecycle (includes legacy aliases). */
export const PROJECTION_LIFECYCLE_STATUSES = [
  "draft_request",
  "pending", // legacy alias of draft_request
  "validation_failed",
  "queued",
  "generating",
  "generated",
  "clinician_review",
  "approved",
  "rejected",
  "superseded",
  "failed",
  "expired",
] as const satisfies readonly PreSurgeryProjectionStatus[];

const ALLOWED_TRANSITIONS: Record<PreSurgeryProjectionStatus, readonly PreSurgeryProjectionStatus[]> = {
  draft_request: ["validation_failed", "queued", "failed"],
  pending: ["validation_failed", "queued", "failed", "generated"], // legacy paths
  validation_failed: [],
  queued: ["generating", "failed", "expired"],
  generating: ["generated", "failed", "validation_failed", "expired"],
  generated: ["clinician_review", "validation_failed", "failed", "rejected"],
  clinician_review: ["approved", "rejected", "expired"],
  approved: ["superseded", "expired"],
  rejected: [],
  superseded: [],
  failed: [],
  expired: [],
};

export type TransitionProjectionStatusResult =
  | { ok: true; from: PreSurgeryProjectionStatus; to: PreSurgeryProjectionStatus }
  | { ok: false; code: "invalid_transition"; message: string; from: PreSurgeryProjectionStatus; to: PreSurgeryProjectionStatus };

export function canTransitionProjectionStatus(
  from: PreSurgeryProjectionStatus,
  to: PreSurgeryProjectionStatus
): boolean {
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function assertProjectionStatusTransition(
  from: PreSurgeryProjectionStatus,
  to: PreSurgeryProjectionStatus
): TransitionProjectionStatusResult {
  if (canTransitionProjectionStatus(from, to)) {
    return { ok: true, from, to };
  }
  return {
    ok: false,
    code: "invalid_transition",
    message: `Illegal projection status transition ${from} → ${to}`,
    from,
    to,
  };
}

/** Normalise legacy pending → draft_request for new writes. */
export function normaliseProjectionStatus(
  status: PreSurgeryProjectionStatus
): PreSurgeryProjectionStatus {
  return status === "pending" ? "draft_request" : status;
}

/** Patient-visible terminal states only — never generated / review / rejected / failed. */
export function isPatientVisibleProjectionStatus(status: PreSurgeryProjectionStatus): boolean {
  return status === "approved";
}

/** Completed generation artifact (ready for clinician review) — not patient-visible. */
export function isCompletedGenerationStatus(status: PreSurgeryProjectionStatus): boolean {
  return status === "generated" || status === "clinician_review";
}

export function isTerminalFailureStatus(status: PreSurgeryProjectionStatus): boolean {
  return status === "failed" || status === "validation_failed" || status === "expired";
}
