import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ExternalClinicState,
  HaNexusClinicEntitlementRow,
  HaNexusClinicMembershipRow,
  HaNexusExternalClinicRow,
} from "@/lib/nexus/nexusProvisioningTypes";

function asClinicRow(row: Record<string, unknown>): HaNexusExternalClinicRow {
  return row as unknown as HaNexusExternalClinicRow;
}

function asMembershipRow(row: Record<string, unknown>): HaNexusClinicMembershipRow {
  return row as unknown as HaNexusClinicMembershipRow;
}

function asEntitlementRow(row: Record<string, unknown>): HaNexusClinicEntitlementRow {
  return row as unknown as HaNexusClinicEntitlementRow;
}

export function buildClinicReconciliationWarnings(state: {
  clinic: HaNexusExternalClinicRow | null;
  membership: HaNexusClinicMembershipRow | null;
  activeEntitlements: HaNexusClinicEntitlementRow[];
}): string[] {
  const warnings: string[] = [];

  if (!state.clinic && (state.membership || state.activeEntitlements.length > 0)) {
    warnings.push("membership_or_entitlements_exist_without_external_clinic_record");
  }

  if (state.membership) {
    const status = state.membership.approval_status;
    if ((status === "revoked" || status === "suspended") && state.activeEntitlements.length > 0) {
      warnings.push(`active_entitlements_present_for_${status}_clinic_membership`);
    }
    if (status === "pending" && state.activeEntitlements.length > 0) {
      warnings.push("active_entitlements_present_for_pending_clinic_membership");
    }
  }

  if (
    state.clinic?.clinic_profile_id &&
    state.membership?.clinic_profile_id &&
    state.clinic.clinic_profile_id !== state.membership.clinic_profile_id
  ) {
    warnings.push("clinic_profile_id_mismatch_between_external_clinic_and_membership");
  }

  return warnings;
}

export async function readExternalClinicState(
  globalClinicId: string,
  client?: SupabaseClient
): Promise<
  | { ok: true; state: ExternalClinicState }
  | { ok: false; error: string; httpStatus: number }
> {
  const gid = globalClinicId.trim();
  if (!gid) {
    return { ok: false, error: "globalClinicId is required.", httpStatus: 400 };
  }

  const supabase = client ?? createSupabaseAdminClient();

  const { data: clinicData, error: clinicErr } = await supabase
    .from("hairaudit_nexus_external_clinics")
    .select("*")
    .eq("global_clinic_id", gid)
    .maybeSingle();

  if (clinicErr) {
    return { ok: false, error: clinicErr.message, httpStatus: 500 };
  }

  const { data: membershipData, error: membershipErr } = await supabase
    .from("hairaudit_nexus_clinic_memberships")
    .select("*")
    .eq("global_clinic_id", gid)
    .maybeSingle();

  if (membershipErr) {
    return { ok: false, error: membershipErr.message, httpStatus: 500 };
  }

  const { data: entitlementsData, error: entitlementsErr } = await supabase
    .from("hairaudit_nexus_clinic_entitlements")
    .select("*")
    .eq("global_clinic_id", gid)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (entitlementsErr) {
    return { ok: false, error: entitlementsErr.message, httpStatus: 500 };
  }

  const { count, error: auditErr } = await supabase
    .from("hairaudit_nexus_provisioning_audit")
    .select("id", { count: "exact", head: true })
    .eq("global_clinic_id", gid);

  if (auditErr) {
    return { ok: false, error: auditErr.message, httpStatus: 500 };
  }

  const clinic = clinicData ? asClinicRow(clinicData as Record<string, unknown>) : null;
  const membership = membershipData
    ? asMembershipRow(membershipData as Record<string, unknown>)
    : null;
  const activeEntitlements = (entitlementsData ?? []).map((r) =>
    asEntitlementRow(r as Record<string, unknown>)
  );

  const state: ExternalClinicState = {
    clinic,
    membership,
    activeEntitlements,
    clinicProfileId: clinic?.clinic_profile_id ?? membership?.clinic_profile_id ?? null,
    auditCount: count ?? 0,
    reconciliationWarnings: buildClinicReconciliationWarnings({
      clinic,
      membership,
      activeEntitlements,
    }),
  };

  return { ok: true, state };
}

export async function writeNexusClinicProvisioningAudit(
  input: {
    globalClinicId: string;
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
    entity_type: "clinic",
    global_clinic_id: input.globalClinicId.trim(),
    global_professional_id: input.globalClinicId.trim(),
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
