/**
 * Centralized auditor role resolution.
 * Primary: profiles.role === "auditor"
 * Fallback (always on): email === auditor@hairaudit.com
 */
const AUDITOR_EMAIL = "auditor@hairaudit.com";

export function isAuditor(args: {
  profileRole?: string | null;
  userEmail?: string | null;
}): boolean {
  if (args.profileRole === "auditor") return true;
  if ((args.userEmail ?? "").toLowerCase() === AUDITOR_EMAIL) return true;
  return false;
}

export function resolveAuditorRole(args: {
  profileRole?: string | null;
  userMetadataRole?: unknown;
  userEmail?: string | null;
}): "auditor" | "patient" | "doctor" | "clinic" {
  if (args.profileRole === "auditor") return "auditor";
  if ((args.userEmail ?? "").toLowerCase() === AUDITOR_EMAIL) return "auditor";
  const fromMeta = args.profileRole ?? args.userMetadataRole;
  if (fromMeta === "doctor") return "doctor";
  if (fromMeta === "clinic") return "clinic";
  if (fromMeta === "auditor") return "auditor";
  return "patient";
}
