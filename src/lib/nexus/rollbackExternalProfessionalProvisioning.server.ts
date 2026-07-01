import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { HaNexusRollbackPayload, RollbackResult } from "@/lib/nexus/nexusProvisioningTypes";
import { GLOBAL_PROFESSIONAL_ID_RE } from "@/lib/nexus/nexusProvisioningTypes";
import {
  readExternalProfessionalState,
  writeNexusProvisioningAudit,
} from "@/lib/nexus/readExternalProfessionalState.server";

function validateRollbackPayload(
  payload: HaNexusRollbackPayload
): { ok: true } | { ok: false; error: string } {
  const globalProfessionalId = payload.globalProfessionalId?.trim() ?? "";
  if (!GLOBAL_PROFESSIONAL_ID_RE.test(globalProfessionalId)) {
    return { ok: false, error: "Invalid globalProfessionalId." };
  }

  const reason = payload.reason?.trim() ?? "";
  if (!reason) {
    return { ok: false, error: "reason is required." };
  }

  return { ok: true };
}

export async function rollbackExternalProfessionalProvisioning(
  payload: HaNexusRollbackPayload,
  client?: SupabaseClient
): Promise<RollbackResult> {
  const validation = validateRollbackPayload(payload);
  if (!validation.ok) {
    return { ok: false, error: validation.error, httpStatus: 400 };
  }

  const globalProfessionalId = payload.globalProfessionalId.trim();
  const action = payload.action?.trim().toLowerCase() === "suspend" ? "suspend" : "revoke";
  const supabase = client ?? createSupabaseAdminClient();

  const beforeStateResult = await readExternalProfessionalState(globalProfessionalId, supabase);
  const beforeState = beforeStateResult.ok ? beforeStateResult.state : null;

  try {
    const now = new Date().toISOString();
    const approvalStatus = action === "suspend" ? "suspended" : "revoked";

    const { error: entitlementsErr } = await supabase
      .from("hairaudit_nexus_entitlements")
      .update({ active: false, revoked_at: now })
      .eq("global_professional_id", globalProfessionalId)
      .eq("nexus_created", true)
      .eq("active", true);

    if (entitlementsErr) throw new Error(entitlementsErr.message);

    const membershipUpdate: Record<string, unknown> = {
      approval_status: approvalStatus,
      provision_status: "rolled_back",
    };
    if (action === "suspend") membershipUpdate.suspended_at = now;
    else membershipUpdate.revoked_at = now;

    const { error: membershipErr } = await supabase
      .from("hairaudit_nexus_memberships")
      .update(membershipUpdate)
      .eq("global_professional_id", globalProfessionalId)
      .eq("nexus_created", true);

    if (membershipErr) throw new Error(membershipErr.message);

    const doctorProfileId = beforeState?.doctorProfileId;
    if (doctorProfileId) {
      const participationStatus = action === "suspend" ? "pending_review" : "more_info_required";
      await supabase
        .from("doctor_profiles")
        .update({ participation_approval_status: participationStatus })
        .eq("id", doctorProfileId);
    }

    const stateResult = await readExternalProfessionalState(globalProfessionalId, supabase);
    if (!stateResult.ok) {
      return { ok: false, error: stateResult.error, httpStatus: stateResult.httpStatus };
    }

    await writeNexusProvisioningAudit(
      {
        globalProfessionalId,
        actionType: "rollback",
        payload: { ...payload, reason: payload.reason.trim(), action } as unknown as Record<
          string,
          unknown
        >,
        beforeState: beforeState as unknown as Record<string, unknown> | null,
        afterState: stateResult.state as unknown as Record<string, unknown>,
        result: "success",
      },
      supabase
    );

    return { ok: true, state: stateResult.state };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rollback failed.";
    try {
      await writeNexusProvisioningAudit(
        {
          globalProfessionalId,
          actionType: "rollback",
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
