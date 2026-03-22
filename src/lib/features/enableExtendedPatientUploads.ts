/**
 * Stage 3: surface optional extended patient photo categories in the upload UI.
 * Toggle with env; when false, behavior matches pre–Stage 3 (extended UI omitted).
 *
 * Set `NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS=true` (public prefix required so the
 * client upload components can read it). Rollback: remove or set to false and redeploy.
 *
 * Important: the default (no-argument) path must use a **literal**
 * `process.env.NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS` access. Next.js replaces
 * `process.env.NEXT_PUBLIC_*` at build time only when the key is statically analyzable;
 * dynamic lookups like `env[SOME_CONSTANT]` are not inlined and are undefined in the client bundle.
 */

export const ENABLE_EXTENDED_PATIENT_UPLOADS = "NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS";

function isTruthyExtendedFlag(raw: string | undefined): boolean {
  return String(raw ?? "").toLowerCase() === "true";
}

/**
 * Whether extended patient upload groups should show in the UI.
 * @param envOverride - When provided (e.g. in unit tests), read the flag from this object instead of `process.env`.
 */
export function isExtendedPatientUploadsEnabled(
  envOverride?: Readonly<Record<string, string | undefined>>
): boolean {
  if (envOverride !== undefined) {
    return isTruthyExtendedFlag(envOverride[ENABLE_EXTENDED_PATIENT_UPLOADS]);
  }
  return isTruthyExtendedFlag(process.env.NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS);
}
