/**
 * Patient-safe summary translated narrative pilot (Batch 19).
 * Rollback: ENABLE_PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT=false and rebuild.
 */

export const ENABLE_PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT = "ENABLE_PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT";

export function isPatientSafeSummaryTranslationPilotEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  const raw = String(env[ENABLE_PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT] ?? "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}
