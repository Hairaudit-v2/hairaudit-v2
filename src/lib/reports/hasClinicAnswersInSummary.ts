/**
 * Whether structured clinic answers exist on a report summary (aligned with CaseReadinessCard).
 * Ignores `field_provenance`-only objects.
 */
export function hasClinicAnswersInSummary(summary: Record<string, unknown> | null | undefined): boolean {
  const clinicAnswers = summary?.clinic_answers;
  if (!clinicAnswers || typeof clinicAnswers !== "object" || Array.isArray(clinicAnswers)) return false;
  const keys = Object.keys(clinicAnswers as Record<string, unknown>).filter((k) => k !== "field_provenance");
  return keys.length > 0;
}
