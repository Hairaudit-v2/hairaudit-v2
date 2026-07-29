/**
 * Client-safe path helpers for the patient intake funnel (HA-AUTH-HANDOFF-FIX).
 * Keep free of node:crypto / server secrets.
 */

export function patientContactReturnPath(caseId: string, handoffToken?: string | null): string {
  const base = `/cases/${caseId}/patient/contact`;
  if (!handoffToken) return base;
  const params = new URLSearchParams({ handoff: handoffToken });
  return `${base}?${params.toString()}`;
}

export function patientReviewPath(caseId: string): string {
  return `/cases/${caseId}/patient/review`;
}

/** Canonical case surface (project equivalent of /dashboard/patient/cases/{id}). */
export function patientCaseDashboardPath(caseId: string): string {
  return `/cases/${caseId}`;
}
