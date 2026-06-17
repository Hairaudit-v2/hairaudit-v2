import { parseRole, type UserRole } from "@/lib/roles";
import { isAuditor } from "@/lib/auth/isAuditor";

export type ProfileRoleUpsertDecision =
  | { ok: true; role: UserRole }
  | { ok: false; reason: "role_escalation_forbidden" | "invalid_signup_role" };

/**
 * Resolves the profile role for POST /api/profiles.
 * Blocks self-service escalation to doctor/clinic after initial onboarding.
 * Allows doctor/clinic only on first profile creation when auth metadata matches signup intent.
 */
export function resolveProfileUpsertRole(args: {
  existingProfileRole: string | null | undefined;
  requestedRole: unknown;
  userEmail: string | undefined;
  userMetadataRole: unknown;
}): ProfileRoleUpsertDecision {
  const existingRole = parseRole(args.existingProfileRole);
  const hasExistingProfile = args.existingProfileRole != null && String(args.existingProfileRole).trim() !== "";
  const requested = parseRole(args.requestedRole);
  const metadataRole = parseRole(args.userMetadataRole);

  if (isAuditor({ profileRole: args.existingProfileRole, userEmail: args.userEmail })) {
    return { ok: true, role: "auditor" };
  }

  if (requested === "auditor") {
    return { ok: true, role: existingRole };
  }

  if (!hasExistingProfile) {
    if (requested === "doctor" || requested === "clinic") {
      if (metadataRole === requested) {
        return { ok: true, role: requested };
      }
      return { ok: false, reason: "invalid_signup_role" };
    }
    return { ok: true, role: "patient" };
  }

  if ((requested === "doctor" || requested === "clinic") && requested !== existingRole) {
    return { ok: false, reason: "role_escalation_forbidden" };
  }

  if (existingRole === "doctor" || existingRole === "clinic") {
    return { ok: true, role: existingRole };
  }

  return { ok: true, role: "patient" };
}
