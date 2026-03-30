/** Case row fields needed for submission / guide-unlock logic. */
export type CaseSubmitStatusFields = {
  status?: string | null;
  submitted_at?: string | null;
};

export type CaseRowForSubmitCta = CaseSubmitStatusFields & { id: string };

/** True once the patient has completed an audit submission (any case). */
export function patientHasSubmittedAudit(
  cases: readonly (CaseSubmitStatusFields & { id?: string })[] | null | undefined
): boolean {
  for (const c of cases ?? []) {
    const status = String(c.status ?? "");
    if (c.submitted_at) return true;
    if (["submitted", "processing", "complete", "audit_failed"].includes(status)) return true;
  }
  return false;
}

/**
 * Mirrors submit-button lock: patient can still reach submit/resubmit for this case.
 */
export function caseSubmitSurfaceOpen(c: CaseSubmitStatusFields): boolean {
  const caseStatus = String(c.status ?? "draft");
  const submittedAt = c.submitted_at;
  const locked = caseStatus === "submitted" || (Boolean(submittedAt) && caseStatus !== "audit_failed");
  return !locked;
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
