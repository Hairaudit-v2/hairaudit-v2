/** Case row fields needed for submission / guide-unlock logic. */
export type CaseSubmitStatusFields = {
  status?: string | null;
  submitted_at?: string | null;
};

/** Fields used for Post-Operative Hair Protection Guide eligibility (patient transplant audits). */
export type CaseRowForPostOpGuide = CaseSubmitStatusFields & {
  audit_type?: string | null;
};

export type CaseRowForSubmitCta = CaseSubmitStatusFields & { id: string };

/**
 * Status values that may appear on `cases.status` after a successful /api/submit, including
 * pipeline phases (see setCasePipelineStatus in inngest) and post-submit workflow states.
 * Used as a fallback when submitted_at is missing on legacy rows.
 */
const CASE_STATUS_AFTER_PATIENT_SUBMIT = new Set<string>([
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
]);

export function hasSubmittedAtTimestamp(c: CaseSubmitStatusFields): boolean {
  const v = c.submitted_at;
  return v != null && String(v).trim() !== "";
}

/** True when the case is past draft in a way that implies /api/submit succeeded or legacy equivalent. */
export function isCaseMarkedSuccessfullySubmitted(c: CaseSubmitStatusFields): boolean {
  if (hasSubmittedAtTimestamp(c)) return true;
  const s = String(c.status ?? "").trim();
  if (!s || s === "draft") return false;
  return CASE_STATUS_AFTER_PATIENT_SUBMIT.has(s);
}

/**
 * Patient-facing hair transplant audit on the shared `cases` table (not doctor/clinic professional audits).
 * Null/undefined audit_type is treated as patient for legacy rows.
 */
export function isPatientTransplantAuditCase(c: Pick<CaseRowForPostOpGuide, "audit_type">): boolean {
  const t = c.audit_type;
  if (t === "doctor" || t === "clinic") return false;
  return true;
}

/** Guide unlock: independent patient transplant case + successful submission (derived; no extra flags). */
export function canUnlockPostOpGuide(c: CaseRowForPostOpGuide): boolean {
  return isPatientTransplantAuditCase(c) && isCaseMarkedSuccessfullySubmitted(c);
}

export function patientHasUnlockedPostOpGuide(
  cases: readonly CaseRowForPostOpGuide[] | null | undefined
): boolean {
  for (const c of cases ?? []) {
    if (canUnlockPostOpGuide(c)) return true;
  }
  return false;
}

/**
 * @deprecated Prefer patientHasUnlockedPostOpGuide or canUnlockPostOpGuide; name kept for incremental refactors.
 * True when any patient transplant case qualifies for the HLI post-op guide.
 */
export function patientHasSubmittedAudit(
  cases: readonly CaseRowForPostOpGuide[] | null | undefined
): boolean {
  return patientHasUnlockedPostOpGuide(cases);
}

/**
 * Mirrors submit-button lock: patient can still reach submit/resubmit for this case.
 * Uses the same “successfully submitted” signal as the HLI guide (status pipeline + submitted_at).
 */
export function caseSubmitSurfaceOpen(c: CaseSubmitStatusFields): boolean {
  if (String(c.status ?? "").trim() === "audit_failed") return true;
  return !isCaseMarkedSuccessfullySubmitted(c);
}

/** First case the patient can submit or resubmit; for dashboard CTAs. */
export function firstCaseOpenForSubmit(
  cases: readonly CaseRowForSubmitCta[] | null | undefined
): CaseRowForSubmitCta | null {
  for (const c of cases ?? []) {
    if (c.id && caseSubmitSurfaceOpen(c)) return c;
  }
  return null;
}
