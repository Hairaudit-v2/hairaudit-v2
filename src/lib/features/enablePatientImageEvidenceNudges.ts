/**
 * Patient-facing optional upload tips from image evidence sufficiency (informational only).
 * Rollback: set NEXT_PUBLIC_ENABLE_PATIENT_IMAGE_EVIDENCE_NUDGES=false and rebuild.
 * Default: on when unset.
 */

export const ENABLE_PATIENT_IMAGE_EVIDENCE_NUDGES = "NEXT_PUBLIC_ENABLE_PATIENT_IMAGE_EVIDENCE_NUDGES";

export function isPatientImageEvidenceNudgesEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_PATIENT_IMAGE_EVIDENCE_NUDGES] ?? "true").toLowerCase() !== "false";
}
