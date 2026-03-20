/**
 * Clinic case view: informational prompts from patient image sufficiency (Stage 8).
 * Rollback: NEXT_PUBLIC_ENABLE_CLINIC_EVIDENCE_PROMPTS=false and rebuild.
 */

export const ENABLE_CLINIC_EVIDENCE_PROMPTS = "NEXT_PUBLIC_ENABLE_CLINIC_EVIDENCE_PROMPTS";

export function isClinicEvidencePromptsEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_CLINIC_EVIDENCE_PROMPTS] ?? "").toLowerCase() === "true";
}
