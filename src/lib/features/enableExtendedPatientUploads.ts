/**
 * Stage 3: surface optional extended patient photo categories in the upload UI.
 * Toggle with env; when false, behavior matches pre–Stage 3 (extended UI omitted).
 *
 * Set `NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS=true` (public prefix required so the
 * client upload components can read it). Rollback: remove or set to false and redeploy.
 */

export const ENABLE_EXTENDED_PATIENT_UPLOADS = "NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS";

export function isExtendedPatientUploadsEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_EXTENDED_PATIENT_UPLOADS] ?? "").toLowerCase() === "true";
}
