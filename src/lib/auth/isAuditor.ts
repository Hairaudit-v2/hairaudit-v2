/**
 * Centralized auditor role resolution.
 * Primary: profiles.role === "auditor"
 * Fallback (optional): email === auditor@hairaudit.com when ALLOW_AUDITOR_EMAIL_OVERRIDE=true
 *
 * Set ALLOW_AUDITOR_EMAIL_OVERRIDE=true for the auditor login flow until profiles are populated.
 * Once all auditors have profile.role set, unset to rely solely on profiles.
 */
const AUDITOR_EMAIL = "auditor@hairaudit.com";

export function isAuditor(args: {
  profileRole?: string | null;
  userEmail?: string | null;
}): boolean {
  if (args.profileRole === "auditor") return true;
  const allowEmailOverride =
    process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE === "true" ||
    process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE === "1";
  if (allowEmailOverride && args.userEmail === AUDITOR_EMAIL) return true;
  return false;
}

export function resolveAuditorRole(args: {
  profileRole?: string | null;
  userMetadataRole?: unknown;
  userEmail?: string | null;
}): "auditor" | "patient" | "doctor" | "clinic" {
  if (args.profileRole === "auditor") return "auditor";
  const allowEmailOverride =
    process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE === "true" ||
    process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE === "1";
  if (allowEmailOverride && args.userEmail === AUDITOR_EMAIL) return "auditor";
  const fromMeta = args.profileRole ?? args.userMetadataRole;
  if (fromMeta === "doctor") return "doctor";
  if (fromMeta === "clinic") return "clinic";
  if (fromMeta === "auditor") return "auditor";
  return "patient";
}
