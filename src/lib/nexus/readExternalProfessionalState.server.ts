import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ExternalProfessionalState,
  HaNexusEntitlementRow,
  HaNexusExternalProfessionalRow,
  HaNexusMembershipRow,
  ReadStateResult,
} from "@/lib/nexus/nexusProvisioningTypes";

function asProfessionalRow(row: Record<string, unknown>): HaNexusExternalProfessionalRow {
  return row as unknown as HaNexusExternalProfessionalRow;
}

function asMembershipRow(row: Record<string, unknown>): HaNexusMembershipRow {
  return row as unknown as HaNexusMembershipRow;
}

function asEntitlementRow(row: Record<string, unknown>): HaNexusEntitlementRow {
  return row as unknown as HaNexusEntitlementRow;
}

export function buildReconciliationWarnings(state: {
  professional: HaNexusExternalProfessionalRow | null;
  membership: HaNexusMembershipRow | null;
  activeEntitlements: HaNexusEntitlementRow[];
}): string[] {
  const warnings: string[] = [];

  if (
    !state.professional &&
    (state.membership || state.activeEntitlements.length > 0)
  ) {
    warnings.push("membership_or_entitlements_exist_without_external_professional_record");
  }

  if (state.membership) {
    const status = state.membership.approval_status;
    if ((status === "revoked" || status === "suspended") && state.activeEntitlements.length > 0) {
      warnings.push(`active_entitlements_present_for_${status}_membership`);
    }
    if (status === "pending" && state.activeEntitlements.length > 0) {
      warnings.push("active_entitlements_present_for_pending_membership");
    }
  }

  if (
    state.professional?.doctor_profile_id &&
    state.membership?.doctor_profile_id &&
    state.professional.doctor_profile_id !== state.membership.doctor_profile_id
  ) {
    warnings.push("doctor_profile_id_mismatch_between_professional_and_membership");
  }

  return warnings;
}

export async function readExternalProfessionalState(
  globalProfessionalId: string,
  client?: SupabaseClient
): Promise<ReadStateResult> {
  const gid = globalProfessionalId.trim();
  if (!gid) {
    return { ok: false, error: "globalProfessionalId is required.", httpStatus: 400 };
  }

  const supabase = client ?? createSupabaseAdminClient();

  const { data: professionalData, error: professionalErr } = await supabase
    .from("hairaudit_nexus_external_professionals")
    .select("*")
    .eq("global_professional_id", gid)
    .maybeSingle();

  if (professionalErr) {
    return { ok: false, error: professionalErr.message, httpStatus: 500 };
  }

  const { data: membershipData, error: membershipErr } = await supabase
    .from("hairaudit_nexus_memberships")
    .select("*")
    .eq("global_professional_id", gid)
    .maybeSingle();

  if (membershipErr) {
    return { ok: false, error: membershipErr.message, httpStatus: 500 };
  }

  const { data: entitlementsData, error: entitlementsErr } = await supabase
    .from("hairaudit_nexus_entitlements")
    .select("*")
    .eq("global_professional_id", gid)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (entitlementsErr) {
    return { ok: false, error: entitlementsErr.message, httpStatus: 500 };
  }

  const { count, error: auditErr } = await supabase
    .from("hairaudit_nexus_provisioning_audit")
    .select("id", { count: "exact", head: true })
    .eq("global_professional_id", gid);

  if (auditErr) {
    return { ok: false, error: auditErr.message, httpStatus: 500 };
  }

  const professional = professionalData
    ? asProfessionalRow(professionalData as Record<string, unknown>)
    : null;
  const membership = membershipData
    ? asMembershipRow(membershipData as Record<string, unknown>)
    : null;
  const activeEntitlements = (entitlementsData ?? []).map((r) =>
    asEntitlementRow(r as Record<string, unknown>)
  );

  const state: ExternalProfessionalState = {
    professional,
    membership,
    activeEntitlements,
    doctorProfileId: professional?.doctor_profile_id ?? membership?.doctor_profile_id ?? null,
    auditCount: count ?? 0,
    reconciliationWarnings: buildReconciliationWarnings({
      professional,
      membership,
      activeEntitlements,
    }),
  };

  return { ok: true, state };
}

export async function writeNexusProvisioningAudit(
  input: {
    globalProfessionalId: string;
    actionType: string;
    payload?: Record<string, unknown> | null;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    result: string;
    failureReason?: string | null;
  },
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? createSupabaseAdminClient();
  const { error } = await supabase.from("hairaudit_nexus_provisioning_audit").insert({
    global_professional_id: input.globalProfessionalId.trim(),
    action_type: input.actionType,
    payload: input.payload ?? null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    result: input.result,
    failure_reason: input.failureReason ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}
