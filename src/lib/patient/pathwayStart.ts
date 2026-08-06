/**
 * HA-PATHWAY-START-403-FIX — client-safe pathway start helpers (no server imports).
 */

import { isAuditor } from "@/lib/auth/isAuditor";
import { dashboardPathForRole } from "@/lib/auth/redirects";
import { parseRole, type UserRole } from "@/lib/roles";
import { normalizeAuthEmail } from "@/lib/patient/intakeCaseHandoffToken";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

/** Local copy — avoid importing intakeCaseOwnership (Node crypto) into client graphs. */
function isAnonymousAuthUser(user: {
  is_anonymous?: boolean | null;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  const provider = String(user.app_metadata?.provider ?? "");
  if (provider === "anonymous") return true;
  if (!normalizeAuthEmail(user.email)) return true;
  return false;
}

export type PathwayStartErrorCode =
  | "PROFILE_REQUIRED"
  | "ROLE_NOT_ALLOWED"
  | "EXISTING_CASE"
  | "UNAUTHORIZED";

export type PathwayStartAuthClass =
  | "anonymous"
  | "patient"
  | "professional"
  | "auditor"
  | "authenticated_no_profile";

export type PathwayStartDiagnostics = {
  pathname: string;
  pathway: PatientReviewPathway | null;
  authUserPresent: boolean;
  profilePresent: boolean;
  resolvedRole: string | null;
  existingCasePresent: boolean;
  authorizationDecision: "allow" | "deny" | "resume" | "provision_then_allow";
  redirectDecision: string | null;
  rejectionReason: string | null;
};

export function logPathwayStart(fields: PathwayStartDiagnostics): void {
  console.info("[pathway-start]", {
    pathname: fields.pathname,
    pathway: fields.pathway,
    authUserPresent: fields.authUserPresent,
    profilePresent: fields.profilePresent,
    resolvedRole: fields.resolvedRole,
    existingCasePresent: fields.existingCasePresent,
    authorizationDecision: fields.authorizationDecision,
    redirectDecision: fields.redirectDecision,
    rejectionReason: fields.rejectionReason,
  });
}

export function classifyPathwayStartActor(args: {
  user: {
    id: string;
    email?: string | null;
    is_anonymous?: boolean | null;
    app_metadata?: Record<string, unknown> | null;
  } | null;
  profileRole: string | null | undefined;
}): {
  authClass: PathwayStartAuthClass;
  resolvedRole: UserRole | null;
  profilePresent: boolean;
} {
  if (!args.user) {
    return { authClass: "anonymous", resolvedRole: null, profilePresent: false };
  }

  const profilePresent =
    args.profileRole != null && String(args.profileRole).trim() !== "";
  const auditor = isAuditor({
    profileRole: args.profileRole,
    userEmail: args.user.email,
  });

  if (auditor) {
    return { authClass: "auditor", resolvedRole: "auditor", profilePresent };
  }

  if (!profilePresent) {
    if (isAnonymousAuthUser(args.user)) {
      return { authClass: "anonymous", resolvedRole: null, profilePresent: false };
    }
    return {
      authClass: "authenticated_no_profile",
      resolvedRole: null,
      profilePresent: false,
    };
  }

  const role = parseRole(args.profileRole);
  if (role === "doctor" || role === "clinic") {
    return { authClass: "professional", resolvedRole: role, profilePresent: true };
  }
  return { authClass: "patient", resolvedRole: "patient", profilePresent: true };
}

/** Professional / auditor accounts must not create patient pathway cases. */
export function professionalRoleBlock(args: {
  authClass: PathwayStartAuthClass;
  resolvedRole: UserRole | null;
  pathway: PatientReviewPathway;
}): {
  blocked: true;
  code: "ROLE_NOT_ALLOWED";
  next: string;
  message: string;
} | null {
  if (args.authClass !== "auditor" && args.authClass !== "professional") {
    return null;
  }
  const role = args.resolvedRole ?? "auditor";
  const next = dashboardPathForRole(role);
  const label =
    role === "auditor" ? "auditor" : role === "clinic" ? "clinic" : "doctor";
  return {
    blocked: true,
    code: "ROLE_NOT_ALLOWED",
    next,
    message: `This ${label} account cannot start a patient ${
      args.pathway === "pre_surgery" ? "Pre-Surgery Review" : "Post-Surgery Audit"
    }. Open your professional dashboard instead.`,
  };
}

export function photosStepForCase(
  caseId: string,
  pathway: PatientReviewPathway,
  entryContext?: string | null
): string {
  if (pathway === "post_surgery" && entryContext === "donor_healing") {
    return `/cases/${caseId}/patient/photos?entry_context=donor_healing`;
  }
  return `/cases/${caseId}/patient/photos`;
}

export function authReturnPathForPathway(pathway: PatientReviewPathway): string {
  return `/request-review?pathway=${encodeURIComponent(pathway)}`;
}
