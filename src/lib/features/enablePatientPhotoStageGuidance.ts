/**
 * Intake-driven patient photo upload guidance (callouts, timeline emphasis).
 * Public env so client components can read it.
 */
export const ENABLE_PATIENT_PHOTO_STAGE_GUIDANCE = "NEXT_PUBLIC_ENABLE_PATIENT_PHOTO_STAGE_GUIDANCE";

export function isPatientPhotoStageGuidanceEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_PATIENT_PHOTO_STAGE_GUIDANCE] ?? "").toLowerCase() === "true";
}
