/**
 * Centralized auditor role resolution.
 * Primary: profiles.role === "auditor"
 * Email fallback: only when {@link allowAuditorEmailFallback} is true
 * (`ALLOW_AUDITOR_EMAIL_OVERRIDE=true` or local `NODE_ENV=development`).
 */
const AUDITOR_EMAIL = "auditor@hairaudit.com";

/** Documented in docs/AUDITOR_EMAIL_OVERRIDE_RETIREMENT.md */
export function allowAuditorEmailFallback(): boolean {
  if (process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE === "true") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export function isAuditor(args: {
  profileRole?: string | null;
  userEmail?: string | null;
}): boolean {
  if (args.profileRole === "auditor") return true;
  if (allowAuditorEmailFallback() && (args.userEmail ?? "").toLowerCase() === AUDITOR_EMAIL) return true;
  return false;
}

export function resolveAuditorRole(args: {
  profileRole?: string | null;
  userMetadataRole?: unknown;
  userEmail?: string | null;
}): "auditor" | "patient" | "doctor" | "clinic" {
  if (isAuditor({ profileRole: args.profileRole, userEmail: args.userEmail })) return "auditor";
  const fromMeta = args.profileRole ?? args.userMetadataRole;
  if (fromMeta === "doctor") return "doctor";
  if (fromMeta === "clinic") return "clinic";
  if (fromMeta === "auditor") return "auditor";
  return "patient";
}
