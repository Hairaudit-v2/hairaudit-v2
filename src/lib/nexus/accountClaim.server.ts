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
  clinicProfileId?: string | null;
  globalProfessionalId?: string | null;
  globalClinicId?: string | null;
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
    clinic_profile_id: input.clinicProfileId ?? null,
    global_professional_id: input.globalProfessionalId ?? null,
    global_clinic_id: input.globalClinicId ?? null,
    linked_user_id: input.linkedUserId ?? null,
    action: input.action,
    actor_type: input.actorType,
    actor_user_id: input.actorUserId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

async function revokeActiveTokensForSubject(
  supabase: SupabaseClient,
  input: {
    subjectType: "doctor" | "clinic";
    profileId: string;
    actor: { actorType: AccountClaimActorType; actorUserId?: string | null; reason?: string };
  }
): Promise<void> {
  const now = new Date().toISOString();
  const profileCol = input.subjectType === "doctor" ? "doctor_profile_id" : "clinic_profile_id";

  const { data: activeTokens, error: listErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select("id, global_professional_id, global_clinic_id, doctor_profile_id, clinic_profile_id, claim_subject_type")
    .eq(profileCol, input.profileId)
    .eq("claim_subject_type", input.subjectType)
    .is("claimed_at", null)
    .is("revoked_at", null);

  if (listErr) throw new Error(listErr.message);
  if (!activeTokens?.length) return;

  const { error: updateErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .update({ revoked_at: now })
    .eq(profileCol, input.profileId)
    .eq("claim_subject_type", input.subjectType)
    .is("claimed_at", null)
    .is("revoked_at", null);

  if (updateErr) throw new Error(updateErr.message);

  for (const row of activeTokens) {
    await writeAccountLinkAudit(supabase, {
      doctorProfileId: row.doctor_profile_id,
      clinicProfileId: row.clinic_profile_id,
      globalProfessionalId: row.global_professional_id,
      globalClinicId: row.global_clinic_id,
      action: "token_revoked",
      actorType: input.actor.actorType,
      actorUserId: input.actor.actorUserId ?? null,
      reason: input.actor.reason ?? "superseded_by_new_token",
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

  await revokeActiveTokensForSubject(supabase, {
    subjectType: "doctor",
    profileId: input.doctorProfileId,
    actor: {
      actorType: input.createdByUserId ? "admin" : "system",
      actorUserId: input.createdByUserId ?? null,
      reason: input.resend ? "superseded_by_resend" : "superseded_by_new_token",
    },
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
      claim_subject_type: "doctor",
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

export async function createClaimTokenForClinicProfile(
  supabase: SupabaseClient,
  input: {
    clinicProfileId: string;
    globalClinicId: string;
    intendedEmail: string;
    clinicName?: string;
    externalClinicId?: string | null;
    createdBySystem?: string;
    createdByUserId?: string | null;
    ttlMs?: number;
    metadata?: Record<string, unknown>;
    resend?: boolean;
  }
): Promise<CreateClaimTokenResult> {
  const { data: profile, error: profileErr } = await supabase
    .from("clinic_profiles")
    .select("id, external_clinic_id, linked_user_id, clinic_email, clinic_name")
    .eq("id", input.clinicProfileId)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);
  if (!profile?.id) throw new Error("Clinic profile not found.");
  if (!profile.external_clinic_id?.trim()) {
    throw new Error("Account claim is only available for network-provisioned clinic profiles.");
  }
  if (profile.external_clinic_id.trim() !== input.globalClinicId.trim()) {
    throw new Error("globalClinicId does not match clinic profile external_clinic_id.");
  }
  if (profile.linked_user_id) {
    throw new Error("Clinic profile is already linked to a user.");
  }

  await revokeActiveTokensForSubject(supabase, {
    subjectType: "clinic",
    profileId: input.clinicProfileId,
    actor: {
      actorType: input.createdByUserId ? "admin" : "system",
      actorUserId: input.createdByUserId ?? null,
      reason: input.resend ? "superseded_by_resend" : "superseded_by_new_token",
    },
  });

  const plaintextToken = generateAccountClaimToken();
  const tokenHash = hashAccountClaimToken(plaintextToken);
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString();
  const emailSnapshot = input.intendedEmail.trim() || String(profile.clinic_email ?? "").trim();
  if (!emailSnapshot) throw new Error("intendedEmail is required for claim token.");

  const { data: inserted, error: insertErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .insert({
      token_hash: tokenHash,
      claim_subject_type: "clinic",
      global_clinic_id: input.globalClinicId.trim(),
      clinic_profile_id: input.clinicProfileId,
      intended_email_snapshot: emailSnapshot,
      role_snapshot: "clinic",
      expires_at: expiresAt,
      created_by_system: input.createdBySystem?.trim() || "nexus",
      created_by_user_id: input.createdByUserId ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        clinic_name: input.clinicName?.trim() || profile.clinic_name,
      },
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(insertErr.message);

  await writeAccountLinkAudit(supabase, {
    clinicProfileId: input.clinicProfileId,
    globalClinicId: input.globalClinicId.trim(),
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
  await revokeActiveTokensForSubject(supabase, {
    subjectType: "doctor",
    profileId: doctorProfileId,
    actor: {
      actorType: actor.actorType ?? "admin",
      actorUserId: actor.actorUserId ?? null,
      reason: actor.reason ?? "manual_revoke",
    },
  });
}

export async function revokeClaimTokensForClinicProfile(
  supabase: SupabaseClient,
  clinicProfileId: string,
  actor: { actorType?: AccountClaimActorType; actorUserId?: string | null; reason?: string } = {}
): Promise<void> {
  await revokeActiveTokensForSubject(supabase, {
    subjectType: "clinic",
    profileId: clinicProfileId,
    actor: {
      actorType: actor.actorType ?? "admin",
      actorUserId: actor.actorUserId ?? null,
      reason: actor.reason ?? "manual_revoke",
    },
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
    .eq("claim_subject_type", "doctor")
    .is("claimed_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (tokenErr) throw new Error(tokenErr.message);

  const { data: latestClaimed, error: claimedErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select("claimed_at")
    .eq("doctor_profile_id", doctorProfileId)
    .eq("claim_subject_type", "doctor")
    .not("claimed_at", "is", null)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (claimedErr) throw new Error(claimedErr.message);

  return {
    subjectType: "doctor",
    doctorProfileId: profile.id,
    globalProfessionalId: profile.external_provider_id.trim(),
    hasActiveToken: Boolean(activeToken?.expires_at),
    activeTokenExpiresAt: activeToken?.expires_at ?? null,
    claimedAt: latestClaimed?.claimed_at ?? null,
    revokedAt: activeToken?.revoked_at ?? null,
    linkedUserId: profile.linked_user_id ?? null,
  };
}

export async function getClaimStatusForClinicProfile(
  supabase: SupabaseClient,
  clinicProfileId: string
): Promise<AccountClaimStatus | null> {
  const { data: profile, error: profileErr } = await supabase
    .from("clinic_profiles")
    .select("id, external_clinic_id, linked_user_id")
    .eq("id", clinicProfileId)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);
  if (!profile?.id || !profile.external_clinic_id?.trim()) return null;

  const { data: activeToken, error: tokenErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select("expires_at, claimed_at, revoked_at")
    .eq("clinic_profile_id", clinicProfileId)
    .eq("claim_subject_type", "clinic")
    .is("claimed_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (tokenErr) throw new Error(tokenErr.message);

  const { data: latestClaimed, error: claimedErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select("claimed_at")
    .eq("clinic_profile_id", clinicProfileId)
    .eq("claim_subject_type", "clinic")
    .not("claimed_at", "is", null)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (claimedErr) throw new Error(claimedErr.message);

  return {
    subjectType: "clinic",
    clinicProfileId: profile.id,
    globalClinicId: profile.external_clinic_id.trim(),
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
  claim_subject_type: "doctor" | "clinic";
  global_professional_id: string | null;
  global_clinic_id: string | null;
  doctor_profile_id: string | null;
  clinic_profile_id: string | null;
  intended_email_snapshot: string;
  role_snapshot: string;
  expires_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
  metadata: Record<string, unknown>;
} | null> {
  const { data, error } = await supabase
    .from("hairaudit_account_claim_tokens")
    .select(
      "id, claim_subject_type, global_professional_id, global_clinic_id, doctor_profile_id, clinic_profile_id, intended_email_snapshot, role_snapshot, expires_at, claimed_at, revoked_at, token_hash, metadata"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as {
    id: string;
    token_hash: string;
    claim_subject_type: "doctor" | "clinic";
    global_professional_id: string | null;
    global_clinic_id: string | null;
    doctor_profile_id: string | null;
    clinic_profile_id: string | null;
    intended_email_snapshot: string;
    role_snapshot: string;
    expires_at: string;
    claimed_at: string | null;
    revoked_at: string | null;
    metadata: Record<string, unknown>;
  };
}

function resolveDisplayName(row: {
  claim_subject_type: "doctor" | "clinic";
  role_snapshot: string;
  metadata: Record<string, unknown>;
}): string {
  if (row.claim_subject_type === "clinic") {
    const clinicName = String(row.metadata?.clinic_name ?? "").trim();
    if (clinicName) return clinicName;
    return "Clinic";
  }
  return row.role_snapshot.trim() || "doctor";
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
    subjectType: row.claim_subject_type ?? "doctor",
    role: row.role_snapshot,
    displayName: resolveDisplayName(row),
    maskedEmail: maskEmailForClaimPreview(row.intended_email_snapshot),
    expiresAt: row.expires_at,
  };
}

export type ClaimAccountResult =
  | { ok: true; subjectType: "doctor"; doctorProfileId: string }
  | { ok: true; subjectType: "clinic"; clinicProfileId: string }
  | { ok: false; error: string; httpStatus: number; auditReason?: string };

export async function claimAccountWithToken(
  supabase: SupabaseClient,
  input: { token: string; userId: string; userEmail?: string | undefined }
): Promise<ClaimAccountResult> {
  if (isMalformedClaimToken(input.token)) {
    return claimFail(supabase, input.userId, "Invalid claim token.", 400, "malformed_token");
  }

  const tokenHash = hashAccountClaimToken(input.token);
  const tokenRow = await findTokenByHash(supabase, tokenHash);
  if (!tokenRow?.id || !accountClaimTokenHashMatches(tokenRow.token_hash, input.token)) {
    return claimFail(supabase, input.userId, "Invalid or unknown claim token.", 404, "token_not_found");
  }

  const tokenState = validateTokenRowForClaim(tokenRow);
  if (!tokenState.ok) {
    if (tokenState.audit) {
      await writeAccountLinkAudit(supabase, tokenState.audit);
    }
    return claimFail(
      supabase,
      input.userId,
      tokenState.error,
      tokenState.httpStatus,
      tokenState.auditReason,
      tokenState.meta
    );
  }

  if (tokenRow.claim_subject_type === "clinic") {
    return claimClinicAccountWithToken(supabase, input, tokenRow);
  }
  return claimDoctorAccountWithToken(supabase, input, tokenRow);
}

async function claimFail(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
  httpStatus: number,
  auditReason: string,
  meta?: Record<string, unknown>
): Promise<ClaimAccountResult> {
  try {
    await writeAccountLinkAudit(supabase, {
      action: "claim_failed",
      actorType: "doctor",
      actorUserId: userId,
      reason: auditReason,
      metadata: meta ?? {},
    });
  } catch {
    /* best effort */
  }
  return { ok: false, error: reason, httpStatus, auditReason };
}

function validateTokenRowForClaim(tokenRow: NonNullable<Awaited<ReturnType<typeof findTokenByHash>>>) :
  | { ok: true }
  | {
      ok: false;
      error: string;
      httpStatus: number;
      auditReason: string;
      meta?: Record<string, unknown>;
      audit?: WriteAuditInput;
    } {
  if (tokenRow.claimed_at) {
    return {
      ok: false,
      error: "This invite has already been used.",
      httpStatus: 409,
      auditReason: "already_claimed",
      meta: {
        doctor_profile_id: tokenRow.doctor_profile_id,
        clinic_profile_id: tokenRow.clinic_profile_id,
      },
    };
  }
  if (tokenRow.revoked_at) {
    return {
      ok: false,
      error: "This invite has been revoked.",
      httpStatus: 410,
      auditReason: "token_revoked",
    };
  }
  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return {
      ok: false,
      error: "This invite has expired.",
      httpStatus: 410,
      auditReason: "token_expired",
      audit: {
        doctorProfileId: tokenRow.doctor_profile_id,
        clinicProfileId: tokenRow.clinic_profile_id,
        globalProfessionalId: tokenRow.global_professional_id,
        globalClinicId: tokenRow.global_clinic_id,
        action: "token_expired",
        actorType: "system",
        reason: "claim_attempt_after_expiry",
      },
    };
  }
  return { ok: true };
}

async function claimDoctorAccountWithToken(
  supabase: SupabaseClient,
  input: { token: string; userId: string; userEmail?: string | undefined },
  tokenRow: NonNullable<Awaited<ReturnType<typeof findTokenByHash>>>
): Promise<ClaimAccountResult> {
  const fail = (reason: string, httpStatus: number, auditReason: string, meta?: Record<string, unknown>) =>
    claimFail(supabase, input.userId, reason, httpStatus, auditReason, meta);

  if (!tokenRow.doctor_profile_id || !tokenRow.global_professional_id) {
    return fail("Claim could not be processed.", 500, "doctor_token_incomplete");
  }

  const { data: doctorProfile, error: doctorErr } = await supabase
    .from("doctor_profiles")
    .select("id, external_provider_id, linked_user_id")
    .eq("id", tokenRow.doctor_profile_id)
    .maybeSingle();

  if (doctorErr) return fail("Claim could not be processed.", 500, "doctor_profile_lookup_error");
  if (!doctorProfile?.id) return fail("Doctor profile not found.", 404, "doctor_profile_missing");
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

  if (existingDoctorErr) return fail("Claim could not be processed.", 500, "existing_doctor_lookup_error");
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

  if (profileErr) return fail("Claim could not be processed.", 500, "profile_lookup_error");

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

  if (linkErr) return fail("Failed to link doctor profile.", 500, "link_update_failed");

  if (userProfile?.role) {
    const { error: profileUpdateErr } = await supabase
      .from("profiles")
      .update({ role: "doctor", updated_at: now })
      .eq("id", input.userId);
    if (profileUpdateErr) return fail("Failed to update profile role.", 500, "profile_role_update_failed");
  } else {
    const { error: profileInsertErr } = await supabase.from("profiles").insert({
      id: input.userId,
      role: "doctor",
      email: input.userEmail ?? null,
      updated_at: now,
    });
    if (profileInsertErr) return fail("Failed to create profile.", 500, "profile_insert_failed");
  }

  const { error: tokenClaimErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .update({ claimed_at: now, consumed_by_user_id: input.userId })
    .eq("id", tokenRow.id)
    .is("claimed_at", null);

  if (tokenClaimErr) return fail("Failed to finalize claim.", 500, "token_claim_update_failed");

  await revokeActiveTokensForSubject(supabase, {
    subjectType: "doctor",
    profileId: doctorProfile.id,
    actor: { actorType: "system", reason: "claimed" },
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

  return { ok: true, subjectType: "doctor", doctorProfileId: doctorProfile.id };
}

async function claimClinicAccountWithToken(
  supabase: SupabaseClient,
  input: { token: string; userId: string; userEmail?: string | undefined },
  tokenRow: NonNullable<Awaited<ReturnType<typeof findTokenByHash>>>
): Promise<ClaimAccountResult> {
  const fail = (reason: string, httpStatus: number, auditReason: string, meta?: Record<string, unknown>) =>
    claimFail(supabase, input.userId, reason, httpStatus, auditReason, meta);

  if (!tokenRow.clinic_profile_id || !tokenRow.global_clinic_id) {
    return fail("Claim could not be processed.", 500, "clinic_token_incomplete");
  }

  const { data: clinicProfile, error: clinicErr } = await supabase
    .from("clinic_profiles")
    .select("id, external_clinic_id, linked_user_id")
    .eq("id", tokenRow.clinic_profile_id)
    .maybeSingle();

  if (clinicErr) return fail("Claim could not be processed.", 500, "clinic_profile_lookup_error");
  if (!clinicProfile?.id) return fail("Clinic profile not found.", 404, "clinic_profile_missing");
  if (clinicProfile.external_clinic_id?.trim() !== tokenRow.global_clinic_id.trim()) {
    return fail("Claim token does not match clinic profile.", 409, "global_clinic_id_mismatch", {
      clinic_profile_id: clinicProfile.id,
    });
  }
  if (clinicProfile.linked_user_id && clinicProfile.linked_user_id !== input.userId) {
    return fail("This clinic profile is already linked to another account.", 409, "profile_already_linked", {
      clinic_profile_id: clinicProfile.id,
    });
  }

  const { data: existingClinicForUser, error: existingClinicErr } = await supabase
    .from("clinic_profiles")
    .select("id, external_clinic_id")
    .eq("linked_user_id", input.userId)
    .maybeSingle();

  if (existingClinicErr) return fail("Claim could not be processed.", 500, "existing_clinic_lookup_error");
  if (existingClinicForUser?.id && existingClinicForUser.id !== clinicProfile.id) {
    return fail("Your account is already linked to a different clinic profile.", 409, "user_has_other_clinic_profile", {
      existing_clinic_profile_id: existingClinicForUser.id,
    });
  }

  const { data: userProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", input.userId)
    .maybeSingle();

  if (profileErr) return fail("Claim could not be processed.", 500, "profile_lookup_error");

  const existingRole = parseRole(userProfile?.role);
  if (userProfile?.role && existingRole === "patient") {
    return fail(
      "Your account is registered as a patient. Network clinic access requires a separate clinic account.",
      409,
      "patient_role_conflict"
    );
  }
  if (userProfile?.role && existingRole === "doctor") {
    return fail("Doctor accounts cannot claim network clinic profiles.", 409, "doctor_role_conflict");
  }

  const now = new Date().toISOString();
  const { error: linkErr } = await supabase
    .from("clinic_profiles")
    .update({ linked_user_id: input.userId })
    .eq("id", clinicProfile.id)
    .is("linked_user_id", null);

  if (linkErr) return fail("Failed to link clinic profile.", 500, "link_update_failed");

  if (userProfile?.role) {
    const { error: profileUpdateErr } = await supabase
      .from("profiles")
      .update({ role: "clinic", updated_at: now })
      .eq("id", input.userId);
    if (profileUpdateErr) return fail("Failed to update profile role.", 500, "profile_role_update_failed");
  } else {
    const { error: profileInsertErr } = await supabase.from("profiles").insert({
      id: input.userId,
      role: "clinic",
      email: input.userEmail ?? null,
      updated_at: now,
    });
    if (profileInsertErr) return fail("Failed to create profile.", 500, "profile_insert_failed");
  }

  const { error: tokenClaimErr } = await supabase
    .from("hairaudit_account_claim_tokens")
    .update({ claimed_at: now, consumed_by_user_id: input.userId })
    .eq("id", tokenRow.id)
    .is("claimed_at", null);

  if (tokenClaimErr) return fail("Failed to finalize claim.", 500, "token_claim_update_failed");

  await revokeActiveTokensForSubject(supabase, {
    subjectType: "clinic",
    profileId: clinicProfile.id,
    actor: { actorType: "system", reason: "claimed" },
  });

  await supabase
    .from("hairaudit_nexus_external_clinics")
    .update({ claimed_by_user_id: input.userId })
    .eq("global_clinic_id", tokenRow.global_clinic_id);

  await writeAccountLinkAudit(supabase, {
    clinicProfileId: clinicProfile.id,
    globalClinicId: tokenRow.global_clinic_id,
    linkedUserId: input.userId,
    action: "token_claimed",
    actorType: "doctor",
    actorUserId: input.userId,
    metadata: { token_id: tokenRow.id },
  });

  return { ok: true, subjectType: "clinic", clinicProfileId: clinicProfile.id };
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

export async function ensureClaimTokenForUnlinkedNexusClinic(
  supabase: SupabaseClient,
  input: {
    clinicProfileId: string;
    globalClinicId: string;
    email: string;
    clinicName?: string;
  }
): Promise<CreateClaimTokenResult | null> {
  const { data: profile, error } = await supabase
    .from("clinic_profiles")
    .select("id, linked_user_id, external_clinic_id, clinic_name")
    .eq("id", input.clinicProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile?.id || profile.linked_user_id || !profile.external_clinic_id?.trim()) {
    return null;
  }

  const status = await getClaimStatusForClinicProfile(supabase, input.clinicProfileId);
  if (status?.hasActiveToken) {
    return {
      tokenId: "",
      expiresAt: status.activeTokenExpiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS).toISOString(),
      plaintextToken: "",
      created: false,
    };
  }

  return createClaimTokenForClinicProfile(supabase, {
    clinicProfileId: input.clinicProfileId,
    globalClinicId: input.globalClinicId,
    intendedEmail: input.email,
    clinicName: input.clinicName ?? profile.clinic_name,
    metadata: { source: "nexus_provision" },
  });
}
