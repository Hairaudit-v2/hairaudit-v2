/**
 * Clinic case view: patient follow-up photo timeline (Stage 8).
 * Rollback: NEXT_PUBLIC_ENABLE_FOLLOWUP_TIMELINE=false and rebuild.
 */

export const ENABLE_FOLLOWUP_TIMELINE = "NEXT_PUBLIC_ENABLE_FOLLOWUP_TIMELINE";

export function isFollowupTimelineEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_FOLLOWUP_TIMELINE] ?? "").toLowerCase() === "true";
}
