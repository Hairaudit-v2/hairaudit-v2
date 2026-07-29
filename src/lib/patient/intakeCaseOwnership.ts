/**
 * HA-AUTH-HANDOFF-FIX — canonical intake case ownership / handoff service.
 *
 * Transfers draft patient cases from an anonymous (or prior) owner to a
 * registered patient after verified sign-in. Fail-closed on ambiguous identity.
 * Never mutates patient_review_pathway during claim.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import {
  isPatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import {
  emailsMatch,
  generateIntakeHandoffToken,
  hashIntakeHandoffToken,
  isMalformedIntakeHandoffToken,
  maskPatientEmail,
  normalizeAuthEmail,
} from "@/lib/patient/intakeCaseHandoffToken";
import {
  patientContactReturnPath,
  patientReviewPath,
} from "@/lib/patient/intakeCasePaths";

export {
  patientCaseDashboardPath,
  patientContactReturnPath,
  patientReviewPath,
} from "@/lib/patient/intakeCasePaths";

export const INTAKE_OWNERSHIP_LOG_PREFIX = "[audit/intake-ownership]";

const HANDOFF_TTL_MS = 60 * 60 * 1000; // 1 hour

export type IntakeAuthStateSource =
  | "server_getUser"
  | "handoff_redeem"
  | "claim_account"
  | "login_gate";

export type IntakeCaseRow = {
  id: string;
  user_id: string | null;
  patient_id: string | null;
  patient_review_pathway: string | null;
  status?: string | null;
  patient_email?: string | null;
};

export type OwnershipReconcileResult =
  | {
      ok: true;
      correlationId: string;
      caseId: string;
      ownerUserId: string;
      pathway: PatientReviewPathway;
      alreadyOwned: boolean;
      transferred: boolean;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
      correlationId: string;
      logContext: Record<string, unknown>;
    };

export type CreateHandoffResult =
  | {
      ok: true;
      correlationId: string;
      plaintextToken: string;
      expiresAt: string;
      signInHref: string;
      returnPath: string;
      maskedEmail: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
      correlationId: string;
      logContext: Record<string, unknown>;
    };

export type RedeemHandoffResult =
  | {
      ok: true;
      correlationId: string;
      caseId: string;
      returnPath: string;
      pathway: PatientReviewPathway;
      alreadyOwned: boolean;
      transferred: boolean;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
      correlationId: string;
      logContext: Record<string, unknown>;
    };

function caseOwnerIds(row: IntakeCaseRow): string[] {
  const ids = [row.user_id, row.patient_id].filter((v): v is string => typeof v === "string" && v.length > 0);
  return [...new Set(ids)];
}

function userOwnsCase(row: IntakeCaseRow, userId: string): boolean {
  return caseOwnerIds(row).includes(userId);
}

async function writeOwnershipAudit(
  admin: SupabaseClient,
  input: {
    caseId: string;
    fromUserId?: string | null;
    toUserId?: string | null;
    action: string;
    actorUserId?: string | null;
    reason?: string | null;
    pathwaySnapshot?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await admin.from("hairaudit_intake_case_ownership_audit").insert({
    case_id: input.caseId,
    from_user_id: input.fromUserId ?? null,
    to_user_id: input.toUserId ?? null,
    action: input.action,
    actor_user_id: input.actorUserId ?? null,
    reason: input.reason ?? null,
    pathway_snapshot: input.pathwaySnapshot ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error(INTAKE_OWNERSHIP_LOG_PREFIX, "ownership audit insert failed", {
      caseId: input.caseId,
      action: input.action,
      error: error.message,
    });
  }
}

export function logIntakeAuthDiagnostic(payload: {
  authStateSource: IntakeAuthStateSource;
  authenticatedUserId?: string | null;
  caseId?: string | null;
  pathway?: string | null;
  intendedReturnRoute?: string | null;
  ownershipResult?: string | null;
  redirectReason?: string | null;
  correlationId?: string | null;
  isAnonymous?: boolean | null;
  emailMatched?: boolean | null;
}): void {
  console.info(INTAKE_OWNERSHIP_LOG_PREFIX, "auth_handoff_diagnostic", {
    authStateSource: payload.authStateSource,
    authenticatedUserId: payload.authenticatedUserId ?? null,
    caseId: payload.caseId ?? null,
    pathway: payload.pathway ?? null,
    intendedReturnRoute: payload.intendedReturnRoute ?? null,
    ownershipResult: payload.ownershipResult ?? null,
    redirectReason: payload.redirectReason ?? null,
    correlationId: payload.correlationId ?? null,
    isAnonymous: payload.isAnonymous ?? null,
    emailMatched: payload.emailMatched ?? null,
  });
}

/**
 * Idempotent ownership attach: rightful claimant gains user_id + patient_id.
 * Pathway is never modified. Fails if another patient already owns the case.
 */
export async function reconcileIntakeCaseOwnership(input: {
  admin: SupabaseClient;
  caseId: string;
  claimantUserId: string;
  /** When set, transfer is only allowed from this prior owner (handoff). */
  expectedFromOwnerId?: string | null;
  reason: string;
  correlationId?: string;
}): Promise<OwnershipReconcileResult> {
  const correlationId = input.correlationId ?? randomUUID();
  const { admin, caseId, claimantUserId } = input;

  const { data: row, error } = await admin
    .from("cases")
    .select("id, user_id, patient_id, patient_review_pathway, status, patient_email")
    .eq("id", caseId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      code: "case_lookup_failed",
      error: "Could not load your review.",
      correlationId,
      logContext: { correlationId, caseId, stage: "case_lookup", error: error.message },
    };
  }
  if (!row) {
    return {
      ok: false,
      status: 404,
      code: "case_not_found",
      error: "Review not found.",
      correlationId,
      logContext: { correlationId, caseId, stage: "case_lookup" },
    };
  }

  const caseRow = row as IntakeCaseRow;
  const pathwayRaw = caseRow.patient_review_pathway;
  if (!isPatientReviewPathway(pathwayRaw)) {
    return {
      ok: false,
      status: 409,
      code: "pathway_invalid",
      error: "This review cannot be continued.",
      correlationId,
      logContext: { correlationId, caseId, stage: "pathway", pathway: pathwayRaw },
    };
  }

  if (userOwnsCase(caseRow, claimantUserId)) {
    await writeOwnershipAudit(admin, {
      caseId,
      fromUserId: caseRow.user_id,
      toUserId: claimantUserId,
      action: "ownership_idempotent",
      actorUserId: claimantUserId,
      reason: input.reason,
      pathwaySnapshot: pathwayRaw,
      metadata: { correlationId },
    });
    return {
      ok: true,
      correlationId,
      caseId,
      ownerUserId: claimantUserId,
      pathway: pathwayRaw,
      alreadyOwned: true,
      transferred: false,
    };
  }

  const owners = caseOwnerIds(caseRow);
  if (owners.length === 0) {
    return {
      ok: false,
      status: 409,
      code: "ownership_ambiguous",
      error: "This review cannot be claimed.",
      correlationId,
      logContext: { correlationId, caseId, stage: "ownership_ambiguous" },
    };
  }

  if (input.expectedFromOwnerId) {
    if (!owners.includes(input.expectedFromOwnerId)) {
      return {
        ok: false,
        status: 409,
        code: "owner_mismatch",
        error: "This review is no longer available to claim.",
        correlationId,
        logContext: {
          correlationId,
          caseId,
          stage: "expected_from_owner",
          expectedFromOwnerId: input.expectedFromOwnerId,
        },
      };
    }
  } else {
    // Without an explicit handoff source, refuse attaching a foreign-owned case.
    return {
      ok: false,
      status: 403,
      code: "not_owner",
      error: "You do not have access to this review.",
      correlationId,
      logContext: { correlationId, caseId, stage: "not_owner", claimantUserId },
    };
  }

  // Refuse if any owner id is neither the expected prior owner nor empty.
  const foreignOwner = owners.find((id) => id !== input.expectedFromOwnerId);
  if (foreignOwner) {
    return {
      ok: false,
      status: 409,
      code: "owned_by_other",
      error: "This review belongs to another account.",
      correlationId,
      logContext: { correlationId, caseId, stage: "owned_by_other" },
    };
  }

  const { data: updated, error: updateErr } = await admin
    .from("cases")
    .update({
      user_id: claimantUserId,
      patient_id: claimantUserId,
      // Explicitly do NOT touch patient_review_pathway.
    })
    .eq("id", caseId)
    .eq("user_id", input.expectedFromOwnerId!)
    .select("id, user_id, patient_id, patient_review_pathway")
    .maybeSingle();

  if (updateErr) {
    return {
      ok: false,
      status: 500,
      code: "ownership_update_failed",
      error: "Could not attach your review. Please try again.",
      correlationId,
      logContext: { correlationId, caseId, stage: "ownership_update", error: updateErr.message },
    };
  }
  if (!updated) {
    return {
      ok: false,
      status: 409,
      code: "ownership_race",
      error: "This review is no longer available to claim.",
      correlationId,
      logContext: { correlationId, caseId, stage: "ownership_race" },
    };
  }

  const updatedPathway = (updated as IntakeCaseRow).patient_review_pathway;
  if (updatedPathway !== pathwayRaw) {
    // Defensive: pathway must be immutable through this path.
    console.error(INTAKE_OWNERSHIP_LOG_PREFIX, "pathway mutated unexpectedly", {
      correlationId,
      caseId,
      before: pathwayRaw,
      after: updatedPathway,
    });
  }

  await writeOwnershipAudit(admin, {
    caseId,
    fromUserId: input.expectedFromOwnerId,
    toUserId: claimantUserId,
    action: "ownership_transferred",
    actorUserId: claimantUserId,
    reason: input.reason,
    pathwaySnapshot: pathwayRaw,
    metadata: { correlationId },
  });

  return {
    ok: true,
    correlationId,
    caseId,
    ownerUserId: claimantUserId,
    pathway: pathwayRaw,
    alreadyOwned: false,
    transferred: true,
  };
}

async function revokeActiveHandoffsForCase(
  admin: SupabaseClient,
  caseId: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("hairaudit_intake_case_handoff_tokens")
    .update({ revoked_at: now })
    .eq("case_id", caseId)
    .is("claimed_at", null)
    .is("revoked_at", null);
  if (error) {
    console.error(INTAKE_OWNERSHIP_LOG_PREFIX, "revoke active handoffs failed", {
      caseId,
      reason,
      error: error.message,
    });
  }
}

/**
 * Issue a single-use handoff so an existing account can claim an anon-owned draft.
 */
export async function createIntakeCaseHandoff(input: {
  admin: SupabaseClient;
  caseId: string;
  fromOwnerId: string;
  intendedEmail: string;
  pathway: PatientReviewPathway;
  returnPath?: string | null;
  correlationId?: string;
}): Promise<CreateHandoffResult> {
  const correlationId = input.correlationId ?? randomUUID();
  const email = normalizeAuthEmail(input.intendedEmail);
  if (!email) {
    return {
      ok: false,
      status: 400,
      code: "email_required",
      error: "Please enter a valid email address.",
      correlationId,
      logContext: { correlationId, stage: "email" },
    };
  }

  const returnPath =
    sanitizeNextPath(input.returnPath) ?? patientContactReturnPath(input.caseId);

  await revokeActiveHandoffsForCase(input.admin, input.caseId, "superseded_by_new_token");

  const plaintextToken = generateIntakeHandoffToken();
  const tokenHash = hashIntakeHandoffToken(plaintextToken);
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS).toISOString();

  // Embed token in return path so post-login lands on contact with redeemable handoff.
  const returnWithToken = patientContactReturnPath(input.caseId, plaintextToken);
  const safeReturn = sanitizeNextPath(returnWithToken) ?? patientContactReturnPath(input.caseId);

  const { error: insertErr } = await input.admin.from("hairaudit_intake_case_handoff_tokens").insert({
    token_hash: tokenHash,
    case_id: input.caseId,
    from_owner_id: input.fromOwnerId,
    intended_email_snapshot: email,
    pathway_snapshot: input.pathway,
    return_path: safeReturn,
    expires_at: expiresAt,
  });

  if (insertErr) {
    return {
      ok: false,
      status: 500,
      code: "handoff_create_failed",
      error: "Could not prepare sign-in. Please try again.",
      correlationId,
      logContext: { correlationId, caseId: input.caseId, error: insertErr.message },
    };
  }

  await writeOwnershipAudit(input.admin, {
    caseId: input.caseId,
    fromUserId: input.fromOwnerId,
    action: "handoff_token_created",
    actorUserId: input.fromOwnerId,
    reason: "email_exists",
    pathwaySnapshot: input.pathway,
    metadata: { correlationId, expiresAt, returnPath: safeReturn },
  });

  const signInHref = buildPatientLoginHref(safeReturn);

  return {
    ok: true,
    correlationId,
    plaintextToken,
    expiresAt,
    signInHref,
    returnPath: safeReturn,
    maskedEmail: maskPatientEmail(email),
  };
}

/**
 * Redeem a handoff after the registered user authenticates.
 * Idempotent for the rightful owner; fails closed on invalid/expired/replayed tokens.
 */
export async function redeemIntakeCaseHandoff(input: {
  admin: SupabaseClient;
  plaintextToken: string;
  claimantUserId: string;
  claimantEmail: string | null | undefined;
  correlationId?: string;
}): Promise<RedeemHandoffResult> {
  const correlationId = input.correlationId ?? randomUUID();

  if (isMalformedIntakeHandoffToken(input.plaintextToken)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_token",
      error: "This sign-in link is invalid. Please try again from your review.",
      correlationId,
      logContext: { correlationId, stage: "malformed_token" },
    };
  }

  const tokenHash = hashIntakeHandoffToken(input.plaintextToken);
  const { data: tokenRow, error: tokenErr } = await input.admin
    .from("hairaudit_intake_case_handoff_tokens")
    .select(
      "id, case_id, from_owner_id, intended_email_snapshot, pathway_snapshot, return_path, expires_at, claimed_at, revoked_at, consumed_by_user_id"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenErr) {
    return {
      ok: false,
      status: 500,
      code: "token_lookup_failed",
      error: "Could not verify your sign-in return. Please try again.",
      correlationId,
      logContext: { correlationId, stage: "token_lookup", error: tokenErr.message },
    };
  }
  if (!tokenRow) {
    return {
      ok: false,
      status: 400,
      code: "invalid_token",
      error: "This sign-in link is invalid or has already been used.",
      correlationId,
      logContext: { correlationId, stage: "token_missing" },
    };
  }

  const now = Date.now();
  const expiresAt = Date.parse(String(tokenRow.expires_at));
  if (tokenRow.revoked_at) {
    return {
      ok: false,
      status: 400,
      code: "token_revoked",
      error: "This sign-in link is no longer valid. Please try again from your review.",
      correlationId,
      logContext: { correlationId, caseId: tokenRow.case_id, stage: "token_revoked" },
    };
  }
  if (!Number.isFinite(expiresAt) || expiresAt < now) {
    return {
      ok: false,
      status: 400,
      code: "token_expired",
      error: "This sign-in link has expired. Please try again from your review.",
      correlationId,
      logContext: { correlationId, caseId: tokenRow.case_id, stage: "token_expired" },
    };
  }

  const intendedEmail = normalizeAuthEmail(tokenRow.intended_email_snapshot);
  if (!emailsMatch(intendedEmail, input.claimantEmail)) {
    await writeOwnershipAudit(input.admin, {
      caseId: tokenRow.case_id,
      fromUserId: tokenRow.from_owner_id,
      toUserId: input.claimantUserId,
      action: "handoff_email_mismatch",
      actorUserId: input.claimantUserId,
      reason: "email_mismatch",
      pathwaySnapshot: tokenRow.pathway_snapshot,
      metadata: { correlationId },
    });
    return {
      ok: false,
      status: 403,
      code: "email_mismatch",
      error: "Sign in with the email you entered for this review to continue.",
      correlationId,
      logContext: { correlationId, caseId: tokenRow.case_id, stage: "email_mismatch" },
    };
  }

  if (!isPatientReviewPathway(tokenRow.pathway_snapshot)) {
    return {
      ok: false,
      status: 409,
      code: "pathway_invalid",
      error: "This review cannot be continued.",
      correlationId,
      logContext: { correlationId, caseId: tokenRow.case_id, stage: "pathway_snapshot" },
    };
  }

  // Idempotent replay for rightful owner.
  if (tokenRow.claimed_at) {
    if (tokenRow.consumed_by_user_id === input.claimantUserId) {
      const reconcile = await reconcileIntakeCaseOwnership({
        admin: input.admin,
        caseId: tokenRow.case_id,
        claimantUserId: input.claimantUserId,
        expectedFromOwnerId: tokenRow.from_owner_id,
        reason: "handoff_replay_idempotent",
        correlationId,
      });
      // If already owned by claimant, reconcile without expectedFrom also works:
      if (!reconcile.ok && reconcile.code === "owner_mismatch") {
        const ownedCheck = await reconcileIntakeCaseOwnership({
          admin: input.admin,
          caseId: tokenRow.case_id,
          claimantUserId: input.claimantUserId,
          reason: "handoff_replay_already_owned",
          correlationId,
        });
        if (ownedCheck.ok && ownedCheck.alreadyOwned) {
          return {
            ok: true,
            correlationId,
            caseId: tokenRow.case_id,
            returnPath: sanitizeNextPath(tokenRow.return_path) ?? patientReviewPath(tokenRow.case_id),
            pathway: tokenRow.pathway_snapshot,
            alreadyOwned: true,
            transferred: false,
          };
        }
      }
      if (!reconcile.ok && !(reconcile.code === "not_owner")) {
        // Fall through: try already-owned path
        const owned = await input.admin
          .from("cases")
          .select("id, user_id, patient_id, patient_review_pathway")
          .eq("id", tokenRow.case_id)
          .maybeSingle();
        if (owned.data && userOwnsCase(owned.data as IntakeCaseRow, input.claimantUserId)) {
          return {
            ok: true,
            correlationId,
            caseId: tokenRow.case_id,
            returnPath: sanitizeNextPath(tokenRow.return_path) ?? patientReviewPath(tokenRow.case_id),
            pathway: tokenRow.pathway_snapshot,
            alreadyOwned: true,
            transferred: false,
          };
        }
      }
      if (reconcile.ok) {
        return {
          ok: true,
          correlationId,
          caseId: tokenRow.case_id,
          returnPath: sanitizeNextPath(tokenRow.return_path) ?? patientReviewPath(tokenRow.case_id),
          pathway: tokenRow.pathway_snapshot,
          alreadyOwned: reconcile.alreadyOwned,
          transferred: reconcile.transferred,
        };
      }
    }
    return {
      ok: false,
      status: 400,
      code: "token_replayed",
      error: "This sign-in link has already been used.",
      correlationId,
      logContext: { correlationId, caseId: tokenRow.case_id, stage: "token_replayed" },
    };
  }

  // Verify pathway on case has not changed since handoff was issued.
  const { data: caseRow, error: caseErr } = await input.admin
    .from("cases")
    .select("id, user_id, patient_id, patient_review_pathway")
    .eq("id", tokenRow.case_id)
    .maybeSingle();

  if (caseErr || !caseRow) {
    return {
      ok: false,
      status: 404,
      code: "case_not_found",
      error: "Review not found.",
      correlationId,
      logContext: { correlationId, caseId: tokenRow.case_id, stage: "case_lookup", error: caseErr?.message },
    };
  }

  const livePathway = (caseRow as IntakeCaseRow).patient_review_pathway;
  if (livePathway !== tokenRow.pathway_snapshot) {
    return {
      ok: false,
      status: 409,
      code: "pathway_changed",
      error: "This review cannot be claimed.",
      correlationId,
      logContext: {
        correlationId,
        caseId: tokenRow.case_id,
        stage: "pathway_changed",
        snapshot: tokenRow.pathway_snapshot,
        live: livePathway,
      },
    };
  }

  const reconcile = await reconcileIntakeCaseOwnership({
    admin: input.admin,
    caseId: tokenRow.case_id,
    claimantUserId: input.claimantUserId,
    expectedFromOwnerId: tokenRow.from_owner_id,
    reason: "handoff_redeem",
    correlationId,
  });

  if (!reconcile.ok) {
    // Already owned by claimant (e.g. parallel redeem) — treat as success if true.
    if (userOwnsCase(caseRow as IntakeCaseRow, input.claimantUserId)) {
      await input.admin
        .from("hairaudit_intake_case_handoff_tokens")
        .update({
          claimed_at: new Date().toISOString(),
          consumed_by_user_id: input.claimantUserId,
        })
        .eq("id", tokenRow.id)
        .is("claimed_at", null);
      return {
        ok: true,
        correlationId,
        caseId: tokenRow.case_id,
        returnPath: sanitizeNextPath(tokenRow.return_path) ?? patientReviewPath(tokenRow.case_id),
        pathway: tokenRow.pathway_snapshot,
        alreadyOwned: true,
        transferred: false,
      };
    }
    return {
      ok: false,
      status: reconcile.status,
      code: reconcile.code,
      error: reconcile.error,
      correlationId,
      logContext: reconcile.logContext,
    };
  }

  const { error: claimErr } = await input.admin
    .from("hairaudit_intake_case_handoff_tokens")
    .update({
      claimed_at: new Date().toISOString(),
      consumed_by_user_id: input.claimantUserId,
    })
    .eq("id", tokenRow.id)
    .is("claimed_at", null);

  if (claimErr) {
    console.error(INTAKE_OWNERSHIP_LOG_PREFIX, "mark handoff claimed failed", {
      correlationId,
      caseId: tokenRow.case_id,
      error: claimErr.message,
    });
  }

  await writeOwnershipAudit(input.admin, {
    caseId: tokenRow.case_id,
    fromUserId: tokenRow.from_owner_id,
    toUserId: input.claimantUserId,
    action: "handoff_redeemed",
    actorUserId: input.claimantUserId,
    reason: "handoff_redeem",
    pathwaySnapshot: tokenRow.pathway_snapshot,
    metadata: {
      correlationId,
      transferred: reconcile.transferred,
      alreadyOwned: reconcile.alreadyOwned,
    },
  });

  // After redeem, send them to contact without the token (ownership now holds).
  const returnPath = patientContactReturnPath(tokenRow.case_id);

  return {
    ok: true,
    correlationId,
    caseId: tokenRow.case_id,
    returnPath,
    pathway: tokenRow.pathway_snapshot,
    alreadyOwned: reconcile.alreadyOwned,
    transferred: reconcile.transferred,
  };
}

export function isAnonymousAuthUser(user: {
  is_anonymous?: boolean | null;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  const provider = String(user.app_metadata?.provider ?? "");
  if (provider === "anonymous") return true;
  // GoTrue may leave is_anonymous unset; treat email-less sessions as anonymous drafts.
  if (!normalizeAuthEmail(user.email)) return true;
  return false;
}
