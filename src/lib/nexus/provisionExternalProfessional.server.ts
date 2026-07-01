import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dedupeEntitlementKeys, validateHaNexusEntitlementKeys } from "@/lib/nexus/haNexusEntitlements";
import {
  attachLinkedUserToNexusDoctorProfile,
  linkDoctorIdentityFromNexus,
  validateNexusSourceSystem,
} from "@/lib/nexus/linkDoctorIdentity.server";
import type { HaNexusProvisionPayload, ProvisionResult } from "@/lib/nexus/nexusProvisioningTypes";
import { EMAIL_RE, GLOBAL_PROFESSIONAL_ID_RE } from "@/lib/nexus/nexusProvisioningTypes";
import {
  readExternalProfessionalState,
  writeNexusProvisioningAudit,
} from "@/lib/nexus/readExternalProfessionalState.server";

function normalizeApprovalStatus(raw: string | undefined): string {
  const s = (raw?.trim() || "pending").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "suspended") return "suspended";
  if (s === "revoked") return "revoked";
  if (s === "pending_review") return "pending";
  return "pending";
}

function validateProvisionPayload(
  payload: HaNexusProvisionPayload
): { ok: true } | { ok: false; error: string } {
  const globalProfessionalId = payload.globalProfessionalId?.trim() ?? "";
  if (!GLOBAL_PROFESSIONAL_ID_RE.test(globalProfessionalId)) {
    return { ok: false, error: "Invalid globalProfessionalId." };
  }

  const email = payload.email?.trim() ?? "";
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Valid email is required." };
  }

  const professionalRole = payload.professionalRole?.trim() ?? "";
  if (!professionalRole) {
    return { ok: false, error: "professionalRole is required." };
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

async function upsertExternalProfessional(
  supabase: SupabaseClient,
  payload: HaNexusProvisionPayload,
  globalProfessionalId: string,
  sourceSystem: string,
  doctorProfileId: string
): Promise<void> {
  const row = {
    global_professional_id: globalProfessionalId,
    source_system: sourceSystem,
    source_external_id: payload.sourceExternalId?.trim() || null,
    email: payload.email.trim(),
    full_name: payload.fullName?.trim() || null,
    professional_role: payload.professionalRole.trim(),
    training_status: payload.trainingStatus?.trim() || null,
    certification_level: payload.certificationLevel?.trim() || null,
    doctor_profile_id: doctorProfileId,
    nexus_created: true,
    metadata: payload.metadata ?? {},
  };

  const { error } = await supabase.from("hairaudit_nexus_external_professionals").upsert(row, {
    onConflict: "global_professional_id",
  });
  if (error) throw new Error(error.message);
}

async function upsertMembership(
  supabase: SupabaseClient,
  globalProfessionalId: string,
  doctorProfileId: string,
  approvalStatus: string,
  provisionStatus: string,
  metadata: Record<string, unknown> | null | undefined
): Promise<void> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    global_professional_id: globalProfessionalId,
    doctor_profile_id: doctorProfileId,
    approval_status: approvalStatus,
    provision_status: provisionStatus.trim() || "provisioned",
    nexus_created: true,
    metadata: metadata ?? {},
    suspended_at: approvalStatus === "suspended" ? now : null,
    revoked_at: approvalStatus === "revoked" ? now : null,
  };

  const { error } = await supabase.from("hairaudit_nexus_memberships").upsert(row, {
    onConflict: "global_professional_id",
  });
  if (error) throw new Error(error.message);
}

async function syncEntitlements(
  supabase: SupabaseClient,
  globalProfessionalId: string,
  entitlementKeys: string[],
  approvalStatus: string
): Promise<void> {
  const active = approvalStatus === "approved";
  const validated = validateHaNexusEntitlementKeys(entitlementKeys);
  const keys = validated.ok ? dedupeEntitlementKeys(validated.keys) : [];
  const desired = new Set<string>(keys);

  const { data: existing, error: listErr } = await supabase
    .from("hairaudit_nexus_entitlements")
    .select("id, entitlement_key, active")
    .eq("global_professional_id", globalProfessionalId)
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
      const { error } = await supabase.from("hairaudit_nexus_entitlements").update(patch).eq("id", row.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("hairaudit_nexus_entitlements").insert({
        global_professional_id: globalProfessionalId,
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
        .from("hairaudit_nexus_entitlements")
        .update({ active: false, revoked_at: new Date().toISOString() })
        .eq("id", row.id);
      if (deactivateErr) throw new Error(deactivateErr.message);
    }
  }
}

export async function provisionExternalProfessionalFromNexus(
  payload: HaNexusProvisionPayload,
  client?: SupabaseClient
): Promise<ProvisionResult> {
  const validation = validateProvisionPayload(payload);
  if (!validation.ok) {
    return { ok: false, error: validation.error, httpStatus: 400 };
  }

  const globalProfessionalId = payload.globalProfessionalId.trim();
  const approvalStatus = normalizeApprovalStatus(payload.approvalStatus);
  const provisionStatus = payload.provisionStatus?.trim() || "provisioned";
  const sourceValidation = validateNexusSourceSystem(payload.sourceSystem);
  if (!sourceValidation.ok) {
    return { ok: false, error: sourceValidation.error, httpStatus: 400 };
  }

  const supabase = client ?? createSupabaseAdminClient();

  const beforeStateResult = await readExternalProfessionalState(globalProfessionalId, supabase);
  const beforeState = beforeStateResult.ok ? beforeStateResult.state : null;

  try {
    const linkResult = await linkDoctorIdentityFromNexus(supabase, {
      globalProfessionalId,
      email: payload.email,
      fullName: payload.fullName,
      approvalStatus,
    });

    await upsertExternalProfessional(
      supabase,
      payload,
      globalProfessionalId,
      sourceValidation.source,
      linkResult.doctorProfileId
    );
    await upsertMembership(
      supabase,
      globalProfessionalId,
      linkResult.doctorProfileId,
      approvalStatus,
      provisionStatus,
      payload.metadata
    );
    await syncEntitlements(supabase, globalProfessionalId, payload.entitlementKeys, approvalStatus);

    const stateResult = await readExternalProfessionalState(globalProfessionalId, supabase);
    if (!stateResult.ok) {
      return { ok: false, error: stateResult.error, httpStatus: stateResult.httpStatus };
    }

    await writeNexusProvisioningAudit(
      {
        globalProfessionalId,
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
    const message = err instanceof Error ? err.message : "Provision failed.";
    try {
      await writeNexusProvisioningAudit(
        {
          globalProfessionalId,
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

export { attachLinkedUserToNexusDoctorProfile };
