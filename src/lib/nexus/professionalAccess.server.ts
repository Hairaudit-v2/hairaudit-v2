import type { SupabaseClient } from "@supabase/supabase-js";

import { isAuditor } from "@/lib/auth/isAuditor";
import {
  readHaAllowPublicPatientAudits,
  readHaRequireLocalApprovalForStandaloneProfessionals,
  readHaRequireNexusForProfessionalUpload,
} from "@/lib/nexus/haAccessPolicy.server";
import type { HaNexusEntitlementKey } from "@/lib/nexus/haNexusEntitlements";
import { parseRole, type UserRole } from "@/lib/roles";

export type ProfessionalAccessAction =
  | "dashboard"
  | "case_create"
  | "upload"
  | "submit"
  | "report_access";

export type ProfessionalAccessDecision =
  | { allowed: true; mode: "auditor" | "patient" | "standalone" | "nexus" }
  | { allowed: false; reason: string; httpStatus: number };

type DoctorProfileRow = {
  id: string;
  external_provider_id: string | null;
  participation_approval_status: string | null;
  linked_user_id: string | null;
};

type ClinicProfileRow = {
  id: string;
  participation_approval_status: string | null;
  linked_user_id: string | null;
};

const PROFESSIONAL_UPLOAD_ACTIONS: ReadonlySet<ProfessionalAccessAction> = new Set([
  "case_create",
  "upload",
  "submit",
  "report_access",
]);

const ACTION_ENTITLEMENT: Partial<Record<ProfessionalAccessAction, HaNexusEntitlementKey>> = {
  case_create: "case_creation",
  upload: "clinical_audit_upload",
  submit: "clinical_audit_upload",
  report_access: "report_access",
};

export function mapParticipationApprovalBlocked(status: string | null | undefined): boolean {
  const s = (status ?? "not_started").trim().toLowerCase();
  return s !== "approved";
}

async function loadDoctorProfile(
  admin: SupabaseClient,
  userId: string
): Promise<DoctorProfileRow | null> {
  const { data, error } = await admin
    .from("doctor_profiles")
    .select("id, external_provider_id, participation_approval_status, linked_user_id")
    .eq("linked_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DoctorProfileRow | null) ?? null;
}

async function loadClinicProfile(
  admin: SupabaseClient,
  userId: string
): Promise<ClinicProfileRow | null> {
  const { data, error } = await admin
    .from("clinic_profiles")
    .select("id, participation_approval_status, linked_user_id")
    .eq("linked_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ClinicProfileRow | null) ?? null;
}

async function hasNexusMembership(
  admin: SupabaseClient,
  globalProfessionalId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("hairaudit_nexus_memberships")
    .select("id")
    .eq("global_professional_id", globalProfessionalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

function evaluateStandaloneProfessionalAccess(args: {
  participationApprovalStatus: string | null | undefined;
  action: ProfessionalAccessAction;
}): ProfessionalAccessDecision {
  if (
    readHaRequireNexusForProfessionalUpload() &&
    PROFESSIONAL_UPLOAD_ACTIONS.has(args.action)
  ) {
    return {
      allowed: false,
      reason: "Network verification is required for this professional action.",
      httpStatus: 403,
    };
  }

  if (
    readHaRequireLocalApprovalForStandaloneProfessionals() &&
    mapParticipationApprovalBlocked(args.participationApprovalStatus)
  ) {
    return {
      allowed: false,
      reason: "Professional participation is pending local approval.",
      httpStatus: 403,
    };
  }

  return { allowed: true, mode: "standalone" };
}

async function evaluateNetworkDoctorAccess(
  admin: SupabaseClient,
  globalProfessionalId: string,
  action: ProfessionalAccessAction
): Promise<ProfessionalAccessDecision> {
  const { data: membership, error: membershipErr } = await admin
    .from("hairaudit_nexus_memberships")
    .select("approval_status, provision_status")
    .eq("global_professional_id", globalProfessionalId)
    .maybeSingle();

  if (membershipErr) throw new Error(membershipErr.message);

  const approvalStatus = (membership?.approval_status ?? "pending").toLowerCase();
  if (approvalStatus === "suspended" || approvalStatus === "revoked") {
    return {
      allowed: false,
      reason: "Network professional access is suspended or revoked.",
      httpStatus: 403,
    };
  }

  if (approvalStatus === "pending" || approvalStatus === "pending_review") {
    return {
      allowed: false,
      reason: "Network professional participation is pending approval.",
      httpStatus: 403,
    };
  }

  if (approvalStatus !== "approved") {
    return {
      allowed: false,
      reason: "Network professional participation is not approved.",
      httpStatus: 403,
    };
  }

  const requiredEntitlement = ACTION_ENTITLEMENT[action];
  if (requiredEntitlement) {
    const { data: entitlement, error: entErr } = await admin
      .from("hairaudit_nexus_entitlements")
      .select("id")
      .eq("global_professional_id", globalProfessionalId)
      .eq("entitlement_key", requiredEntitlement)
      .eq("active", true)
      .maybeSingle();

    if (entErr) throw new Error(entErr.message);
    if (!entitlement) {
      return {
        allowed: false,
        reason: `Missing required network entitlement: ${requiredEntitlement}.`,
        httpStatus: 403,
      };
    }
  }

  return { allowed: true, mode: "nexus" };
}

/**
 * Enforces role + standalone local approval OR network Nexus entitlements.
 * Patients and auditors are unchanged unless public patient audits are explicitly disabled.
 */
export async function evaluateProfessionalAccess(args: {
  admin: SupabaseClient;
  userId: string;
  userEmail: string | undefined;
  profileRole: string | null | undefined;
  action: ProfessionalAccessAction;
}): Promise<ProfessionalAccessDecision> {
  const role: UserRole = isAuditor({ profileRole: args.profileRole, userEmail: args.userEmail })
    ? "auditor"
    : parseRole(args.profileRole);

  if (role === "auditor") return { allowed: true, mode: "auditor" };

  if (role === "patient") {
    if (!readHaAllowPublicPatientAudits()) {
      return {
        allowed: false,
        reason: "Public patient audits are not available.",
        httpStatus: 403,
      };
    }
    return { allowed: true, mode: "patient" };
  }

  if (role !== "doctor" && role !== "clinic") {
    return { allowed: false, reason: "Forbidden", httpStatus: 403 };
  }

  if (role === "doctor") {
    if (parseRole(args.profileRole) !== "doctor") {
      return { allowed: false, reason: "Doctor role required.", httpStatus: 403 };
    }
    const doctorProfile = await loadDoctorProfile(args.admin, args.userId);
    if (!doctorProfile) {
      return {
        allowed: false,
        reason: "Doctor profile required. Network professionals must claim their invite before access.",
        httpStatus: 403,
      };
    }

    if (!doctorProfile.linked_user_id || doctorProfile.linked_user_id !== args.userId) {
      return {
        allowed: false,
        reason: "Doctor account is not linked.",
        httpStatus: 403,
      };
    }

    const globalId = doctorProfile.external_provider_id?.trim() ?? "";
    if (globalId && (await hasNexusMembership(args.admin, globalId))) {
      return evaluateNetworkDoctorAccess(args.admin, globalId, args.action);
    }

    return evaluateStandaloneProfessionalAccess({
      participationApprovalStatus: doctorProfile.participation_approval_status,
      action: args.action,
    });
  }

  if (parseRole(args.profileRole) !== "clinic") {
    return { allowed: false, reason: "Clinic role required.", httpStatus: 403 };
  }

  const clinicProfile = await loadClinicProfile(args.admin, args.userId);
  if (!clinicProfile) {
    return { allowed: false, reason: "Clinic profile required.", httpStatus: 403 };
  }

  return evaluateStandaloneProfessionalAccess({
    participationApprovalStatus: clinicProfile.participation_approval_status,
    action: args.action,
  });
}

export async function shouldHideProfessionalCases(args: {
  admin: SupabaseClient;
  userId: string;
  userEmail: string | undefined;
  profileRole: string | null | undefined;
}): Promise<boolean> {
  const decision = await evaluateProfessionalAccess({
    ...args,
    action: "dashboard",
  });
  return !decision.allowed;
}

export async function loadProfileRole(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.role as string | undefined) ?? null;
}
