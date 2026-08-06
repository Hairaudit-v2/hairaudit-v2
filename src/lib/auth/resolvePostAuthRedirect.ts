import { dashboardPathForRole } from "@/lib/auth/redirects";
import type { UserRole } from "@/lib/roles";

/**
 * After session + profile are known, pick the final dashboard path.
 * Prevents temporary patient classification while role is unknown,
 * and keeps auditors off /dashboard/patient.
 */
export function resolvePostAuthRedirect(args: {
  requestedNextPath: string;
  resolvedRole: UserRole | null;
  profileReady: boolean;
}):
  | { path: string; reason: string }
  | { wait: true; reason: string }
  | { noRole: true; path: string; reason: string } {
  const next = args.requestedNextPath;

  if (!args.profileReady) {
    return { wait: true, reason: "role_loading" };
  }

  if (args.resolvedRole == null) {
    return { noRole: true, path: "/beta-access-message", reason: "profile_role_unavailable" };
  }

  const role = args.resolvedRole;

  if (role === "auditor") {
    if (
      next === "/dashboard" ||
      next === "/dashboard/patient" ||
      next.startsWith("/dashboard/patient/")
    ) {
      return { path: "/dashboard/auditor", reason: "auditor_role_override" };
    }
  }

  if (next === "/dashboard") {
    return { path: dashboardPathForRole(role), reason: "canonical_role_dashboard" };
  }

  return { path: next, reason: "explicit_next" };
}
