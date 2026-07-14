/**
 * HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A — anonymous auth → email-backed patient claim.
 *
 * GoTrue maps auth.users unique constraint `users_email_partial_key` (23505) to
 * AuthApiError { code: 'unexpected_failure', message: 'Error updating user' }.
 * Pre-check via hairaudit_auth_email_in_use + map that wrapper to email_exists.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const CLAIM_ACCOUNT_LOG_PREFIX = "[audit/claim-account]";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PATIENT_SAFE_CLAIM_ERROR =
  "Could not save your email. Please try again.";

export const EMAIL_EXISTS_CLAIM_ERROR =
  "That email is already registered. Please sign in to continue.";

export type ClaimAnonymousAccountInput = {
  admin: SupabaseClient;
  userId: string;
  caseId: string;
  email: string;
  firstName: string | null;
  /** Current session user_metadata (merged into the permanent account). */
  userMetadata?: Record<string, unknown> | null;
  /** Optional correlation id; generated when omitted. */
  correlationId?: string;
};

export type ClaimAnonymousAccountResult =
  | { ok: true; correlationId: string; userId: string; caseId: string }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
      correlationId: string;
      logContext: Record<string, unknown>;
    };

type AuthUpdateError = {
  code?: string;
  message?: string;
  status?: number;
};

/**
 * Explicit email-conflict signals from GoTrue / Postgres.
 * Does NOT treat bare unexpected_failure alone as email_exists — that wrapper
 * also covers trigger failures; callers must confirm via hairaudit_auth_email_in_use.
 */
export function isExplicitAuthEmailConflictError(err: AuthUpdateError | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "email_exists") return true;
  const msg = String(err.message ?? "");
  return /already|registered|exists|duplicate|users_email_partial_key|23505/i.test(msg);
}

/** Production-observed GoTrue wrapper around users_email_partial_key (23505). */
export function isOpaqueAuthUpdateFailure(err: AuthUpdateError | null | undefined): boolean {
  if (!err) return false;
  return err.code === "unexpected_failure" && /error updating user/i.test(String(err.message ?? ""));
}

async function isAuthEmailInUseViaListUsers(
  admin: SupabaseClient,
  email: string,
  excludeUserId: string
): Promise<{ inUse: boolean; probeError?: string }> {
  const normalized = email.trim().toLowerCase();
  // Bound pagination — production user count is small enough for smoke/ops probe.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { inUse: false, probeError: error.message };
    const users = data?.users ?? [];
    if (users.some((u) => u.id !== excludeUserId && (u.email ?? "").toLowerCase() === normalized)) {
      return { inUse: true };
    }
    if (users.length < 200) break;
  }
  return { inUse: false };
}

export async function isAuthEmailInUse(
  admin: SupabaseClient,
  email: string,
  excludeUserId: string
): Promise<{ inUse: boolean; probeError?: string }> {
  const { data, error } = await admin.rpc("hairaudit_auth_email_in_use", {
    p_email: email,
    p_exclude_user_id: excludeUserId,
  });
  if (!error) return { inUse: data === true };
  // Fallback when migration RPC is not yet applied (or PostgREST cache warm).
  console.error(CLAIM_ACCOUNT_LOG_PREFIX, "email_in_use rpc unavailable; using listUsers fallback", {
    error: error.message,
  });
  return isAuthEmailInUseViaListUsers(admin, email, excludeUserId);
}

/**
 * Upgrade an anonymous auth user to an email-backed patient account (same uid).
 * Idempotent when the same email is already on this user.
 */
export async function claimAnonymousAccount(
  input: ClaimAnonymousAccountInput
): Promise<ClaimAnonymousAccountResult> {
  const correlationId = input.correlationId ?? randomUUID();
  const { admin, userId, caseId, email, firstName } = input;

  const { data: c, error: caseErr } = await admin
    .from("cases")
    .select("id, user_id, patient_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr) {
    return {
      ok: false,
      status: 500,
      error: "Could not load your audit.",
      correlationId,
      logContext: {
        correlationId,
        userId,
        caseId,
        stage: "case_lookup",
        error: caseErr.message,
      },
    };
  }
  if (!c || (c.user_id !== userId && c.patient_id !== userId)) {
    return {
      ok: false,
      status: 404,
      error: "Audit not found.",
      correlationId,
      logContext: { correlationId, userId, caseId, stage: "ownership" },
    };
  }

  const probe = await isAuthEmailInUse(admin, email, userId);
  if (probe.probeError) {
    // Non-fatal: fall through to updateUserById; still log for ops.
    console.error(CLAIM_ACCOUNT_LOG_PREFIX, "email_in_use probe failed", {
      correlationId,
      userId,
      error: probe.probeError,
    });
  } else if (probe.inUse) {
    return {
      ok: false,
      status: 409,
      error: EMAIL_EXISTS_CLAIM_ERROR,
      code: "email_exists",
      correlationId,
      logContext: {
        correlationId,
        userId,
        caseId,
        stage: "email_in_use_precheck",
        code: "email_exists",
      },
    };
  }

  const nextMetadata: Record<string, unknown> = {
    ...(input.userMetadata ?? {}),
    role: "patient",
  };
  if (firstName) nextMetadata.first_name = firstName;

  const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    email,
    // GoTrue keeps is_anonymous=true while email_confirm is false; confirming here
    // permanently converts the anon session while still allowing a later report-ready
    // verification / welcome email from application code.
    email_confirm: true,
    user_metadata: nextMetadata,
    ...( { is_anonymous: false } as Record<string, unknown> ),
  } as Parameters<SupabaseClient["auth"]["admin"]["updateUserById"]>[1]);

  if (updateErr) {
    let conflict = isExplicitAuthEmailConflictError(updateErr);
    // Opaque wrapper: re-probe auth.users so we do not mislabel trigger failures.
    if (!conflict && isOpaqueAuthUpdateFailure(updateErr)) {
      const confirm = await isAuthEmailInUse(admin, email, userId);
      if (!confirm.probeError && confirm.inUse) conflict = true;
    }
    const logContext = {
      correlationId,
      userId,
      caseId,
      stage: "updateUserById",
      code: updateErr.code,
      error: String(updateErr.message ?? ""),
      emailConflict: conflict,
      postgresHint: conflict ? "users_email_partial_key (23505)" : undefined,
    };
    console.error(CLAIM_ACCOUNT_LOG_PREFIX, "updateUserById failed", logContext);
    if (conflict) {
      return {
        ok: false,
        status: 409,
        error: EMAIL_EXISTS_CLAIM_ERROR,
        code: "email_exists",
        correlationId,
        logContext,
      };
    }
    return {
      ok: false,
      status: 500,
      error: PATIENT_SAFE_CLAIM_ERROR,
      code: updateErr.code,
      correlationId,
      logContext,
    };
  }

  // Idempotent profile sync (trigger also UPSERTs; this covers environments
  // where the UPDATE trigger is not yet applied).
  const profilePatch: Record<string, unknown> = { id: userId, role: "patient", email };
  if (firstName) profilePatch.name = firstName;
  const { error: profileErr } = await admin.from("profiles").upsert(profilePatch, { onConflict: "id" });
  if (profileErr) {
    console.error(CLAIM_ACCOUNT_LOG_PREFIX, "profile upsert failed (non-fatal)", {
      correlationId,
      userId,
      error: profileErr.message,
    });
  }

  return {
    ok: true,
    correlationId,
    userId: updated.user?.id ?? userId,
    caseId,
  };
}
