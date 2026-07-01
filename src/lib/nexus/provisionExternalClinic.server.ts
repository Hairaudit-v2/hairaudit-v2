import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureClaimTokenForUnlinkedNexusClinic } from "@/lib/nexus/accountClaim.server";
import { sendNexusClinicAccountClaimInviteEmail } from "@/lib/nexus/accountClaimEmail.server";
import { dedupeEntitlementKeys, validateHaNexusEntitlementKeys } from "@/lib/nexus/haNexusEntitlements";
import {
  detectClinicIdentityConflict,
  linkClinicIdentityFromNexus,
} from "@/lib/nexus/linkClinicIdentity.server";
import { validateNexusSourceSystem } from "@/lib/nexus/linkDoctorIdentity.server";
import type {
  ClinicProvisionResult,
  HaNexusClinicProvisionPayload,
} from "@/lib/nexus/nexusProvisioningTypes";
import { EMAIL_RE, GLOBAL_CLINIC_ID_RE } from "@/lib/nexus/nexusProvisioningTypes";
import {
  readExternalClinicState,
  writeNexusClinicProvisioningAudit,
} from "@/lib/nexus/readExternalClinicState.server";

function normalizeApprovalStatus(raw: string | undefined): string {
  const s = (raw?.trim() || "pending").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "suspended") return "suspended";
  if (s === "revoked") return "revoked";
  if (s === "pending_review") return "pending";
  return "pending";
}

function normalizeProvisionStatus(raw: string | undefined): string {
  const s = (raw?.trim() || "active").toLowerCase();
  if (s === "pending") return "pending";
  if (s === "rolled_back") return "rolled_back";
  return "active";
}

function validateClinicProvisionPayload(
  payload: HaNexusClinicProvisionPayload
): { ok: true } | { ok: false; error: string } {
  const globalClinicId = payload.globalClinicId?.trim() ?? "";
  if (!GLOBAL_CLINIC_ID_RE.test(globalClinicId)) {
    return { ok: false, error: "Invalid globalClinicId." };
  }

  const clinicName = payload.clinicName?.trim() ?? "";
  if (!clinicName) {
    return { ok: false, error: "clinicName is required." };
  }

  const email = payload.primaryContactEmail?.trim() ?? "";
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Valid primaryContactEmail is required." };
  }

  if (!Array.isArray(payload.entitlementKeys)) {
    return { ok: false, error: "entitlementKeys must be an array." };
  }

  const entitlementValidation = validateHaNexusEntitlementKeys(payload.entitlementKeys);
  if (!entitlementValidation.ok) {
    return {
      ok: false,
      error: `Invalid entitlement key(s): ${entitlementValidation.invalidKeys.join(", ")}`,
    };
  }

  const sourceValidation = validateNexusSourceSystem(payload.sourceSystem);
  if (!sourceValidation.ok) {
    return { ok: false, error: sourceValidation.error };
  }

  return { ok: true };
}

async function upsertExternalClinic(
  supabase: SupabaseClient,
  payload: HaNexusClinicProvisionPayload,
  globalClinicId: string,
  sourceSystem: string,
  clinicProfileId: string
): Promise<void> {
  const row = {
    global_clinic_id: globalClinicId,
    source_system: sourceSystem,
    source_external_id: payload.sourceExternalId?.trim() || null,
    fi_tenant_id: payload.fiTenantId?.trim() || null,
    fi_clinic_id: payload.fiClinicId?.trim() || null,
    clinic_name: payload.clinicName.trim(),
    primary_contact_email: payload.primaryContactEmail.trim(),
    primary_contact_name: payload.primaryContactName?.trim() || null,
    country: payload.country?.trim() || null,
    region: payload.region?.trim() || null,
    clinic_profile_id: clinicProfileId,
    nexus_created: true,
    metadata: payload.metadata ?? {},
  };

  const { error } = await supabase.from("hairaudit_nexus_external_clinics").upsert(row, {
    onConflict: "global_clinic_id",
  });
  if (error) throw new Error(error.message);
}

async function upsertClinicMembership(
  supabase: SupabaseClient,
  globalClinicId: string,
  clinicProfileId: string,
  approvalStatus: string,
  provisionStatus: string,
  metadata: Record<string, unknown> | null | undefined
): Promise<void> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    global_clinic_id: globalClinicId,
    clinic_profile_id: clinicProfileId,
    approval_status: approvalStatus,
    provision_status: provisionStatus,
    nexus_created: true,
    metadata: metadata ?? {},
    suspended_at: approvalStatus === "suspended" ? now : null,
    revoked_at: approvalStatus === "revoked" ? now : null,
  };

  const { error } = await supabase.from("hairaudit_nexus_clinic_memberships").upsert(row, {
    onConflict: "global_clinic_id",
  });
  if (error) throw new Error(error.message);
}

async function syncClinicEntitlements(
  supabase: SupabaseClient,
  globalClinicId: string,
  entitlementKeys: string[],
  approvalStatus: string
): Promise<void> {
  const active = approvalStatus === "approved";
  const validated = validateHaNexusEntitlementKeys(entitlementKeys);
  const keys = validated.ok ? dedupeEntitlementKeys(validated.keys) : [];
  const desired = new Set<string>(keys);

  const { data: existing, error: listErr } = await supabase
    .from("hairaudit_nexus_clinic_entitlements")
    .select("id, entitlement_key, active")
    .eq("global_clinic_id", globalClinicId)
    .eq("nexus_created", true);

  if (listErr) throw new Error(listErr.message);

  const existingByKey = new Map(
    (existing ?? []).map((row) => [String(row.entitlement_key ?? ""), row])
  );

  for (const key of keys) {
    const row = existingByKey.get(key);
    const patch = {
      active,
      revoked_at: active ? null : new Date().toISOString(),
    };
    if (row?.id) {
      const { error } = await supabase
        .from("hairaudit_nexus_clinic_entitlements")
        .update(patch)
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("hairaudit_nexus_clinic_entitlements").insert({
        global_clinic_id: globalClinicId,
        entitlement_key: key,
        nexus_created: true,
        ...patch,
      });
      if (error) throw new Error(error.message);
    }
  }

  for (const row of existing ?? []) {
    const key = String(row.entitlement_key ?? "");
    if (!desired.has(key) && row.active) {
      const { error: deactivateErr } = await supabase
        .from("hairaudit_nexus_clinic_entitlements")
        .update({ active: false, revoked_at: new Date().toISOString() })
        .eq("id", row.id);
      if (deactivateErr) throw new Error(deactivateErr.message);
    }
  }
}

export async function provisionExternalClinicFromNexus(
  payload: HaNexusClinicProvisionPayload,
  client?: SupabaseClient
): Promise<ClinicProvisionResult> {
  const validation = validateClinicProvisionPayload(payload);
  if (!validation.ok) {
    return { ok: false, error: validation.error, httpStatus: 400 };
  }

  const globalClinicId = payload.globalClinicId.trim();
  const approvalStatus = normalizeApprovalStatus(payload.approvalStatus);
  const provisionStatus = normalizeProvisionStatus(payload.provisionStatus);
  const sourceValidation = validateNexusSourceSystem(payload.sourceSystem);
  if (!sourceValidation.ok) {
    return { ok: false, error: sourceValidation.error, httpStatus: 400 };
  }

  const supabase = client ?? createSupabaseAdminClient();

  const beforeStateResult = await readExternalClinicState(globalClinicId, supabase);
  const beforeState = beforeStateResult.ok ? beforeStateResult.state : null;

  const conflict = await detectClinicIdentityConflict(supabase, {
    globalClinicId,
    primaryContactEmail: payload.primaryContactEmail,
  });
  if (conflict) {
    try {
      await writeNexusClinicProvisioningAudit(
        {
          globalClinicId,
          actionType: "provision",
          payload: payload as unknown as Record<string, unknown>,
          beforeState: beforeState as unknown as Record<string, unknown> | null,
          result: "conflict",
          failureReason: conflict.reason,
        },
        supabase
      );
    } catch {
      /* best effort */
    }
    return {
      ok: false,
      error: `Clinic provisioning conflict: ${conflict.reason}. Clinics are never linked by email alone.`,
      httpStatus: 409,
      conflict: true,
    };
  }

  try {
    const linkResult = await linkClinicIdentityFromNexus(supabase, {
      globalClinicId,
      clinicName: payload.clinicName,
      primaryContactEmail: payload.primaryContactEmail,
      primaryContactName: payload.primaryContactName,
      country: payload.country,
      region: payload.region,
      approvalStatus,
    });

    await upsertExternalClinic(
      supabase,
      payload,
      globalClinicId,
      sourceValidation.source,
      linkResult.clinicProfileId
    );
    await upsertClinicMembership(
      supabase,
      globalClinicId,
      linkResult.clinicProfileId,
      approvalStatus,
      provisionStatus,
      payload.metadata
    );
    await syncClinicEntitlements(supabase, globalClinicId, payload.entitlementKeys, approvalStatus);

    const claimTokenResult = await ensureClaimTokenForUnlinkedNexusClinic(supabase, {
      clinicProfileId: linkResult.clinicProfileId,
      globalClinicId,
      email: payload.primaryContactEmail.trim(),
      clinicName: payload.clinicName.trim(),
    });

    if (claimTokenResult?.created && claimTokenResult.plaintextToken) {
      await sendNexusClinicAccountClaimInviteEmail({
        to: payload.primaryContactEmail.trim(),
        claimToken: claimTokenResult.plaintextToken,
        expiresAt: claimTokenResult.expiresAt,
        clinicName: payload.clinicName.trim(),
      });
    }

    const stateResult = await readExternalClinicState(globalClinicId, supabase);
    if (!stateResult.ok) {
      return { ok: false, error: stateResult.error, httpStatus: stateResult.httpStatus };
    }

    await writeNexusClinicProvisioningAudit(
      {
        globalClinicId,
        actionType: "provision",
        payload: payload as unknown as Record<string, unknown>,
        beforeState: beforeState as unknown as Record<string, unknown> | null,
        afterState: stateResult.state as unknown as Record<string, unknown>,
        result: "success",
      },
      supabase
    );

    return { ok: true, state: stateResult.state };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clinic provision failed.";
    try {
      await writeNexusClinicProvisioningAudit(
        {
          globalClinicId,
          actionType: "provision",
          payload: payload as unknown as Record<string, unknown>,
          beforeState: beforeState as unknown as Record<string, unknown> | null,
          result: "failure",
          failureReason: message,
        },
        supabase
      );
    } catch {
      /* best effort */
    }
    return { ok: false, error: message, httpStatus: 500 };
  }
}
