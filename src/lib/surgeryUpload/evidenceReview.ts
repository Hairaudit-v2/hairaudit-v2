// HairAudit Mobile Surgery Upload Portal — Stage 5
// Shared (client + server safe) helpers for the evidence-review workflow. This
// module must stay free of server-only imports so it can be used in both the
// reviewer UI and the API routes.

// ---------------------------------------------------------------------------
// Overall evidence review status
// ---------------------------------------------------------------------------
export const EVIDENCE_REVIEW_STATUSES = [
  "not_reviewed",
  "in_review",
  "needs_more_evidence",
  "evidence_accepted",
  "ready_for_audit",
] as const;

export type EvidenceReviewStatus = (typeof EVIDENCE_REVIEW_STATUSES)[number];

export const EVIDENCE_REVIEW_STATUS_LABELS: Record<EvidenceReviewStatus, string> = {
  not_reviewed: "Not reviewed",
  in_review: "In review",
  needs_more_evidence: "Needs more evidence",
  evidence_accepted: "Evidence accepted",
  ready_for_audit: "Ready for audit",
};

const EVIDENCE_REVIEW_STATUS_SET = new Set<string>(EVIDENCE_REVIEW_STATUSES);

export function isEvidenceReviewStatus(value: unknown): value is EvidenceReviewStatus {
  return typeof value === "string" && EVIDENCE_REVIEW_STATUS_SET.has(value);
}

/** Reviewer-settable overall statuses (not_reviewed is the system default only). */
export const EVIDENCE_REVIEW_ACTION_STATUSES: EvidenceReviewStatus[] = [
  "in_review",
  "needs_more_evidence",
  "evidence_accepted",
  "ready_for_audit",
];

export function evidenceReviewStatusLabel(value: unknown): string {
  return isEvidenceReviewStatus(value)
    ? EVIDENCE_REVIEW_STATUS_LABELS[value]
    : EVIDENCE_REVIEW_STATUS_LABELS.not_reviewed;
}

// ---------------------------------------------------------------------------
// Per-slot review status
// ---------------------------------------------------------------------------
export const SLOT_REVIEW_STATUSES = [
  "not_reviewed",
  "accepted",
  "needs_more_photos",
  "poor_quality",
  "not_applicable",
] as const;

export type SlotReviewStatus = (typeof SLOT_REVIEW_STATUSES)[number];

export const SLOT_REVIEW_STATUS_LABELS: Record<SlotReviewStatus, string> = {
  not_reviewed: "Not reviewed",
  accepted: "Accepted",
  needs_more_photos: "Needs more photos",
  poor_quality: "Poor quality",
  not_applicable: "Not applicable",
};

const SLOT_REVIEW_STATUS_SET = new Set<string>(SLOT_REVIEW_STATUSES);

export function isSlotReviewStatus(value: unknown): value is SlotReviewStatus {
  return typeof value === "string" && SLOT_REVIEW_STATUS_SET.has(value);
}

/** Reviewer-settable per-slot statuses (excludes the default not_reviewed). */
export const SLOT_REVIEW_ACTION_STATUSES: SlotReviewStatus[] = [
  "accepted",
  "needs_more_photos",
  "poor_quality",
  "not_applicable",
];

export function slotReviewStatusLabel(value: unknown): string {
  return isSlotReviewStatus(value)
    ? SLOT_REVIEW_STATUS_LABELS[value]
    : SLOT_REVIEW_STATUS_LABELS.not_reviewed;
}

// ---------------------------------------------------------------------------
// Row shape used across the panel + API
// ---------------------------------------------------------------------------
export type SurgerySlotReviewRow = {
  case_id: string;
  slot_key: string;
  status: SlotReviewStatus;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

/** Minimal shape needed to reason about additional-evidence permissions. */
type EvidenceReviewDetailsLike = {
  status?: string | null;
  evidence_review_status?: string | null;
};

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------
/** Only auditors may set/clear reviewer decisions (overall + per-slot). */
export function canEditEvidenceReview(actor: { isAuditor?: boolean } | null | undefined): boolean {
  return !!actor?.isAuditor;
}

/**
 * Additional evidence is only allowed on a SUBMITTED upload that a reviewer has
 * explicitly flagged as needing more evidence. Draft uploads use the normal
 * upload flow; evidence_accepted / ready_for_audit are locked again.
 */
export function canUploadAdditionalEvidence(details: EvidenceReviewDetailsLike): boolean {
  return (
    details.status === "submitted" &&
    details.evidence_review_status === "needs_more_evidence"
  );
}
