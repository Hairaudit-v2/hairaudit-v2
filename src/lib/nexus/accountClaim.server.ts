import type { SupabaseClient } from "@supabase/supabase-js";

import {
  accountClaimTokenHashMatches,
  generateAccountClaimToken,
  hashAccountClaimToken,
  isMalformedClaimToken,
  maskEmailForClaimPreview,
} from "@/lib/nexus/accountClaimToken.server";
import type {
  AccountClaimActorType,
  AccountClaimLinkAction,
  AccountClaimStatus,
  AccountClaimValidationResult,
  CreateClaimTokenResult,
} from "@/lib/nexus/accountClaimTypes";
import { parseRole } from "@/lib/roles";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type WriteAuditInput = {
  doctorProfileId?: string | null;
  globalProfessionalId?: string | null;
  linkedUserId?: string | null;
  action: AccountClaimLinkAction;
  actorType: AccountClaimActorType;
  actorUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

async function writeAccountLinkAudit(
  supabase: SupabaseClient,
  input: WriteAuditInput
): Promise<void> {
  const { error } = await supabase.from("hairaudit_account_link_audit").insert({
    doctor_profile_id: input.doctorProfileId ?? null,
    global_professional_id: input.globalProfessionalId ?? null,
    linked_user_id: input.linkedUserId ?? null,
    action: input.action,
    actor_type: input.actorType,
    actor_user_id: input.actorUserId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

async function revokeActiveTokensForDoctor(
  supabase: SupabaseClient,
  doctorProfileId: string,
  actor: { actorType: AccountClaimActorType; actorUserId?: string | null; reason?: string }
): Promise<void> {
  const now = new Date().toISOString();
  const { data: activeTokens, error: listErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select("id, global_professional_id, doctor_profile_id")
    .eq("doctor_profile_id", doctorProfileId)
    .is("claimed_at", null)
    .is("revoked_at", null);

  if (listErr) throw new Error(listErr.message);
  if (!activeTokens?.length) return;

  const { error: updateErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .update({ revoked_at: now })
    .eq("doctor_profile_id", doctorProfileId)
    .is("claimed_at", null)
    .is("revoked_at", null);

  if (updateErr) throw new Error(updateErr.message);

  for (const row of activeTokens) {
    await writeAccountLinkAudit(supabase, {
      doctorProfileId: row.doctor_profile_id,
      globalProfessionalId: row.global_professional_id,
      action: "token_revoked",
      actorType: actor.actorType,
      actorUserId: actor.actorUserId ?? null,
      reason: actor.reason ?? "superseded_by_new_token",
    });
  }
}

export async function createClaimTokenForDoctorProfile(
  supabase: SupabaseClient,
  input: {
    doctorProfileId: string;
    globalProfessionalId: string;
    intendedEmail: string;
    roleSnapshot?: string;
    externalProfessionalId?: string | null;
    createdBySystem?: string;
    createdByUserId?: string | null;
    ttlMs?: number;
    metadata?: Record<string, unknown>;
    resend?: boolean;
  }
): Promise<CreateClaimTokenResult> {
  const { data: profile, error: profileErr } = await supabase
    .from("doctor_profiles")
    .select("id, external_provider_id, linked_user_id, doctor_email")
    .eq("id", input.doctorProfileId)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);
  if (!profile?.id) throw new Error("Doctor profile not found.");
  if (!profile.external_provider_id?.trim()) {
    throw new Error("Account claim is only available for network-provisioned doctor profiles.");
  }
  if (profile.external_provider_id.trim() !== input.globalProfessionalId.trim()) {
    throw new Error("globalProfessionalId does not match doctor profile external_provider_id.");
  }
  if (profile.linked_user_id) {
    throw new Error("Doctor profile is already linked to a user.");
  }

  await revokeActiveTokensForDoctor(supabase, input.doctorProfileId, {
    actorType: input.createdByUserId ? "admin" : "system",
    actorUserId: input.createdByUserId ?? null,
    reason: input.resend ? "superseded_by_resend" : "superseded_by_new_token",
  });

  const plaintextToken = generateAccountClaimToken();
  const tokenHash = hashAccountClaimToken(plaintextToken);
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString();
  const emailSnapshot = input.intendedEmail.trim() || String(profile.doctor_email ?? "").trim();
  if (!emailSnapshot) throw new Error("intendedEmail is required for claim token.");

  const { data: inserted, error: insertErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .insert({
      token_hash: tokenHash,
      global_professional_id: input.globalProfessionalId.trim(),
      doctor_profile_id: input.doctorProfileId,
      external_professional_id: input.externalProfessionalId?.trim() || input.globalProfessionalId.trim(),
      intended_email_snapshot: emailSnapshot,
      role_snapshot: input.roleSnapshot?.trim() || "doctor",
      expires_at: expiresAt,
      created_by_system: input.createdBySystem?.trim() || "nexus",
      created_by_user_id: input.createdByUserId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(insertErr.message);

  await writeAccountLinkAudit(supabase, {
    doctorProfileId: input.doctorProfileId,
    globalProfessionalId: input.globalProfessionalId.trim(),
    action: input.resend ? "token_resent" : "token_created",
    actorType: input.createdByUserId ? "admin" : "nexus",
    actorUserId: input.createdByUserId ?? null,
    metadata: { token_id: inserted.id, expires_at: expiresAt },
  });

  return {
    tokenId: inserted.id,
    expiresAt,
    plaintextToken,
    created: true,
  };
}

export async function revokeClaimTokensForDoctorProfile(
  supabase: SupabaseClient,
  doctorProfileId: string,
  actor: { actorType?: AccountClaimActorType; actorUserId?: string | null; reason?: string } = {}
): Promise<void> {
  await revokeActiveTokensForDoctor(supabase, doctorProfileId, {
    actorType: actor.actorType ?? "admin",
    actorUserId: actor.actorUserId ?? null,
    reason: actor.reason ?? "manual_revoke",
  });
}

export async function getClaimStatusForDoctorProfile(
  supabase: SupabaseClient,
  doctorProfileId: string
): Promise<AccountClaimStatus | null> {
  const { data: profile, error: profileErr } = await supabase
    .from("doctor_profiles")
    .select("id, external_provider_id, linked_user_id")
    .eq("id", doctorProfileId)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);
  if (!profile?.id || !profile.external_provider_id?.trim()) return null;

  const { data: activeToken, error: tokenErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select("expires_at, claimed_at, revoked_at")
    .eq("doctor_profile_id", doctorProfileId)
    .is("claimed_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (tokenErr) throw new Error(tokenErr.message);

  const { data: latestClaimed, error: claimedErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select("claimed_at")
    .eq("doctor_profile_id", doctorProfileId)
    .not("claimed_at", "is", null)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (claimedErr) throw new Error(claimedErr.message);

  return {
    doctorProfileId: profile.id,
    globalProfessionalId: profile.external_provider_id.trim(),
    hasActiveToken: Boolean(activeToken?.expires_at),
    activeTokenExpiresAt: activeToken?.expires_at ?? null,
    claimedAt: latestClaimed?.claimed_at ?? null,
    revokedAt: activeToken?.revoked_at ?? null,
    linkedUserId: profile.linked_user_id ?? null,
  };
}

async function findTokenByHash(
  supabase: SupabaseClient,
  tokenHash: string
): Promise<{
  id: string;
  token_hash: string;
  global_professional_id: string;
  doctor_profile_id: string;
  intended_email_snapshot: string;
  role_snapshot: string;
  expires_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
} | null> {
  const { data, error } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select(
      "id, global_professional_id, doctor_profile_id, intended_email_snapshot, role_snapshot, expires_at, claimed_at, revoked_at, token_hash"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data;
}

export async function validateAccountClaimToken(
  supabase: SupabaseClient,
  token: string
): Promise<AccountClaimValidationResult> {
  if (isMalformedClaimToken(token)) {
    return { valid: false, reason: "malformed" };
  }

  const tokenHash = hashAccountClaimToken(token);
  const row = await findTokenByHash(supabase, tokenHash);
  if (!row) {
    return { valid: false, reason: "not_found" };
  }

  if (!accountClaimTokenHashMatches(row.token_hash ?? tokenHash, token)) {
    return { valid: false, reason: "not_found" };
  }

  if (row.claimed_at) return { valid: false, reason: "already_claimed" };
  if (row.revoked_at) return { valid: false, reason: "revoked" };
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { valid: false, reason: "expired" };
  }

  return {
    valid: true,
    role: row.role_snapshot,
    maskedEmail: maskEmailForClaimPreview(row.intended_email_snapshot),
    expiresAt: row.expires_at,
  };
}

export type ClaimAccountResult =
  | { ok: true; doctorProfileId: string }
  | { ok: false; error: string; httpStatus: number; auditReason?: string };

export async function claimAccountWithToken(
  supabase: SupabaseClient,
  input: { token: string; userId: string; userEmail?: string | undefined }
): Promise<ClaimAccountResult> {
  const fail = async (
    reason: string,
    httpStatus: number,
    auditReason: string,
    meta?: Record<string, unknown>
  ): Promise<ClaimAccountResult> => {
    try {
      await writeAccountLinkAudit(supabase, {
        action: "claim_failed",
        actorType: "doctor",
        actorUserId: input.userId,
        reason: auditReason,
        metadata: meta ?? {},
      });
    } catch {
      /* best effort */
    }
    return { ok: false, error: reason, httpStatus, auditReason };
  };

  if (isMalformedClaimToken(input.token)) {
    return fail("Invalid claim token.", 400, "malformed_token");
  }

  const tokenHash = hashAccountClaimToken(input.token);
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select(
      "id, token_hash, global_professional_id, doctor_profile_id, expires_at, claimed_at, revoked_at"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenErr) {
    return fail("Claim could not be processed.", 500, "token_lookup_error");
  }
  if (!tokenRow?.id || !accountClaimTokenHashMatches(tokenRow.token_hash, input.token)) {
    return fail("Invalid or unknown claim token.", 404, "token_not_found");
  }
  if (tokenRow.claimed_at) {
    return fail("This invite has already been used.", 409, "already_claimed", {
      doctor_profile_id: tokenRow.doctor_profile_id,
      global_professional_id: tokenRow.global_professional_id,
    });
  }
  if (tokenRow.revoked_at) {
    return fail("This invite has been revoked.", 410, "token_revoked", {
      doctor_profile_id: tokenRow.doctor_profile_id,
    });
  }
  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    await writeAccountLinkAudit(supabase, {
      doctorProfileId: tokenRow.doctor_profile_id,
      globalProfessionalId: tokenRow.global_professional_id,
      action: "token_expired",
      actorType: "system",
      reason: "claim_attempt_after_expiry",
    });
    return fail("This invite has expired.", 410, "token_expired");
  }

  const { data: doctorProfile, error: doctorErr } = await supabase
    .from("doctor_profiles")
    .select("id, external_provider_id, linked_user_id")
    .eq("id", tokenRow.doctor_profile_id)
    .maybeSingle();

  if (doctorErr) {
    return fail("Claim could not be processed.", 500, "doctor_profile_lookup_error");
  }
  if (!doctorProfile?.id) {
    return fail("Doctor profile not found.", 404, "doctor_profile_missing");
  }
  if (doctorProfile.external_provider_id?.trim() !== tokenRow.global_professional_id.trim()) {
    return fail("Claim token does not match doctor profile.", 409, "global_id_mismatch", {
      doctor_profile_id: doctorProfile.id,
    });
  }
  if (doctorProfile.linked_user_id && doctorProfile.linked_user_id !== input.userId) {
    return fail("This professional profile is already linked to another account.", 409, "profile_already_linked", {
      doctor_profile_id: doctorProfile.id,
    });
  }

  const { data: existingDoctorForUser, error: existingDoctorErr } = await supabase
    .from("doctor_profiles")
    .select("id, external_provider_id")
    .eq("linked_user_id", input.userId)
    .maybeSingle();

  if (existingDoctorErr) {
    return fail("Claim could not be processed.", 500, "existing_doctor_lookup_error");
  }
  if (existingDoctorForUser?.id && existingDoctorForUser.id !== doctorProfile.id) {
    return fail("Your account is already linked to a different doctor profile.", 409, "user_has_other_doctor_profile", {
      existing_doctor_profile_id: existingDoctorForUser.id,
    });
  }

  const { data: userProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", input.userId)
    .maybeSingle();

  if (profileErr) {
    return fail("Claim could not be processed.", 500, "profile_lookup_error");
  }

  const existingRole = parseRole(userProfile?.role);
  if (userProfile?.role && existingRole === "patient") {
    return fail(
      "Your account is registered as a patient. Network professional access requires a separate doctor account.",
      409,
      "patient_role_conflict"
    );
  }
  if (userProfile?.role && existingRole === "clinic") {
    return fail("Clinic accounts cannot claim network doctor profiles.", 409, "clinic_role_conflict");
  }

  const now = new Date().toISOString();
  const { error: linkErr } = await supabase
    .from("doctor_profiles")
    .update({ linked_user_id: input.userId })
    .eq("id", doctorProfile.id)
    .is("linked_user_id", null);

  if (linkErr) {
    return fail("Failed to link doctor profile.", 500, "link_update_failed");
  }

  const profilePayload = {
    id: input.userId,
    role: "doctor" as const,
    email: input.userEmail ?? null,
    updated_at: now,
  };

  if (userProfile?.role) {
    const { error: profileUpdateErr } = await supabase
      .from("profiles")
      .update({ role: "doctor", updated_at: now })
      .eq("id", input.userId);
    if (profileUpdateErr) {
      return fail("Failed to update profile role.", 500, "profile_role_update_failed");
    }
  } else {
    const { error: profileInsertErr } = await supabase.from("profiles").insert(profilePayload);
    if (profileInsertErr) {
      return fail("Failed to create profile.", 500, "profile_insert_failed");
    }
  }

  const { error: tokenClaimErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .update({ claimed_at: now, consumed_by_user_id: input.userId })
    .eq("id", tokenRow.id)
    .is("claimed_at", null);

  if (tokenClaimErr) {
    return fail("Failed to finalize claim.", 500, "token_claim_update_failed");
  }

  await revokeActiveTokensForDoctor(supabase, doctorProfile.id, {
    actorType: "system",
    reason: "claimed",
  });

  await writeAccountLinkAudit(supabase, {
    doctorProfileId: doctorProfile.id,
    globalProfessionalId: tokenRow.global_professional_id,
    linkedUserId: input.userId,
    action: "token_claimed",
    actorType: "doctor",
    actorUserId: input.userId,
    metadata: { token_id: tokenRow.id },
  });

  return { ok: true, doctorProfileId: doctorProfile.id };
}

export async function ensureClaimTokenForUnlinkedNexusDoctor(
  supabase: SupabaseClient,
  input: {
    doctorProfileId: string;
    globalProfessionalId: string;
    email: string;
    professionalRole?: string;
  }
): Promise<CreateClaimTokenResult | null> {
  const { data: profile, error } = await supabase
    .from("doctor_profiles")
    .select("id, linked_user_id, external_provider_id")
    .eq("id", input.doctorProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile?.id || profile.linked_user_id || !profile.external_provider_id?.trim()) {
    return null;
  }

  const status = await getClaimStatusForDoctorProfile(supabase, input.doctorProfileId);
  if (status?.hasActiveToken) {
    return {
      tokenId: "",
      expiresAt: status.activeTokenExpiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS).toISOString(),
      plaintextToken: "",
      created: false,
    };
  }

  return createClaimTokenForDoctorProfile(supabase, {
    doctorProfileId: input.doctorProfileId,
    globalProfessionalId: input.globalProfessionalId,
    intendedEmail: input.email,
    roleSnapshot: input.professionalRole ?? "doctor",
    metadata: { source: "nexus_provision" },
  });
}
