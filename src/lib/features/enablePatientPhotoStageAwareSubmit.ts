/**
 * Optional second submit path: outcome milestone photos when intake `months_since` qualifies.
 * Server-only; evaluated in submit API and Inngest (never trust the client).
 */
export const ENABLE_PATIENT_PHOTO_STAGE_AWARE_SUBMIT = "ENABLE_PATIENT_PHOTO_STAGE_AWARE_SUBMIT";

export function isPatientPhotoStageAwareSubmitEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_PATIENT_PHOTO_STAGE_AWARE_SUBMIT] ?? "").toLowerCase() === "true";
}
