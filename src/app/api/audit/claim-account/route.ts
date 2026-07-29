import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CLAIM_ACCOUNT_LOG_PREFIX,
  EMAIL_EXISTS_CLAIM_ERROR,
  EMAIL_RE,
  claimAnonymousAccount,
  isAuthEmailInUse,
} from "@/lib/audit/claimAnonymousAccount";
import {
  createIntakeCaseHandoff,
  isAnonymousAuthUser,
  logIntakeAuthDiagnostic,
  patientReviewPath,
  reconcileIntakeCaseOwnership,
} from "@/lib/patient/intakeCaseOwnership";
import {
  emailsMatch,
  maskPatientEmail,
  normalizeAuthEmail,
} from "@/lib/patient/intakeCaseHandoffToken";
import {
  isPatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

/**
 * POST /api/audit/claim-account
 *
 * HA-AUTH-HANDOFF-FIX validation order:
 * a) resolve current authenticated user server-side
 * b) normalise entered and authenticated emails
 * c) matching email → ownership reconcile + same-uid claim (no "already registered")
 * d) different permanent email → account_mismatch
 * e) email exists + anon/no permanent session → handoff + sign-in href
 *
 * Does NOT submit the case — next step is /patient/review.
 */

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const caseId = typeof body?.caseId === "string" ? body.caseId.trim() : "";
  const email = normalizeAuthEmail(typeof body?.email === "string" ? body.email : "");
  const firstNameRaw = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const firstName = firstNameRaw ? firstNameRaw.slice(0, 120) : null;

  if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  }

  let supabaseAuth;
  try {
    supabaseAuth = await createSupabaseAuthServerClient();
  } catch (e) {
    console.error(CLAIM_ACCOUNT_LOG_PREFIX, "auth client failed", { error: e });
    return NextResponse.json({ ok: false, error: "Auth unavailable" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    logIntakeAuthDiagnostic({
      authStateSource: "claim_account",
      caseId,
      ownershipResult: "no_session",
      redirectReason: "session_missing",
    });
    return NextResponse.json(
      { ok: false, error: "Your session has expired. Please start again.", code: "session_missing" },
      { status: 401 }
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    console.error(CLAIM_ACCOUNT_LOG_PREFIX, "admin client failed", { userId: user.id, error: e });
    return NextResponse.json({ ok: false, error: "Server configuration error" }, { status: 500 });
  }

  const { data: caseRow, error: caseErr } = await admin
    .from("cases")
    .select("id, user_id, patient_id, patient_review_pathway, status")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !caseRow) {
    return NextResponse.json({ ok: false, error: "Audit not found.", code: "case_not_found" }, { status: 404 });
  }

  const ownsCase = caseRow.user_id === user.id || caseRow.patient_id === user.id;
  if (!ownsCase) {
    logIntakeAuthDiagnostic({
      authStateSource: "claim_account",
      authenticatedUserId: user.id,
      caseId,
      pathway: caseRow.patient_review_pathway,
      ownershipResult: "not_owner",
      isAnonymous: isAnonymousAuthUser(user),
    });
    return NextResponse.json({ ok: false, error: "Audit not found.", code: "not_owner" }, { status: 404 });
  }

  const pathway: PatientReviewPathway | null = isPatientReviewPathway(caseRow.patient_review_pathway)
    ? caseRow.patient_review_pathway
    : null;
  if (!pathway) {
    return NextResponse.json(
      { ok: false, error: "This review cannot be continued.", code: "pathway_invalid" },
      { status: 409 }
    );
  }

  const sessionEmail = normalizeAuthEmail(user.email);
  const anonymous = isAnonymousAuthUser(user);
  const emailMatched = emailsMatch(sessionEmail, email);

  logIntakeAuthDiagnostic({
    authStateSource: "claim_account",
    authenticatedUserId: user.id,
    caseId,
    pathway,
    intendedReturnRoute: patientReviewPath(caseId),
    isAnonymous: anonymous,
    emailMatched,
  });

  // (c) Matching authenticated email — reconcile + upgrade/idempotent claim; never "already registered".
  if (!anonymous && emailMatched) {
    const reconcile = await reconcileIntakeCaseOwnership({
      admin,
      caseId,
      claimantUserId: user.id,
      reason: "matching_authenticated_email",
    });
    if (!reconcile.ok && reconcile.code !== "not_owner") {
      // already owned path should succeed; not_owner shouldn't happen when ownsCase
      console.error(CLAIM_ACCOUNT_LOG_PREFIX, "reconcile unexpected", reconcile.logContext);
    }

    const result = await claimAnonymousAccount({
      admin,
      userId: user.id,
      caseId,
      email,
      firstName,
      userMetadata: user.user_metadata as Record<string, unknown> | undefined,
    });

    if (!result.ok) {
      // Matching session email must not surface email_exists for this uid.
      if (result.code === "email_exists") {
        console.error(CLAIM_ACCOUNT_LOG_PREFIX, "email_exists despite matching session email", result.logContext);
        return NextResponse.json(
          { ok: false, error: "Could not save your email. Please try again.", code: "claim_conflict" },
          { status: 500 }
        );
      }
      console.error(CLAIM_ACCOUNT_LOG_PREFIX, "claim failed", result.logContext);
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code, correlationId: result.correlationId },
        { status: result.status }
      );
    }

    await admin.from("cases").update({ patient_email: email }).eq("id", caseId);

    logIntakeAuthDiagnostic({
      authStateSource: "claim_account",
      authenticatedUserId: user.id,
      caseId,
      pathway,
      ownershipResult: "matched_reconciled",
      intendedReturnRoute: patientReviewPath(caseId),
      correlationId: result.correlationId,
      emailMatched: true,
      isAnonymous: false,
    });

    return NextResponse.json({
      ok: true,
      correlationId: result.correlationId,
      next: patientReviewPath(caseId),
      code: "matched",
    });
  }

  // (d) Permanent session with a different email — do not attach / do not silent-continue.
  if (!anonymous && sessionEmail && !emailMatched) {
    logIntakeAuthDiagnostic({
      authStateSource: "claim_account",
      authenticatedUserId: user.id,
      caseId,
      pathway,
      ownershipResult: "account_mismatch",
      emailMatched: false,
      isAnonymous: false,
    });
    return NextResponse.json(
      {
        ok: false,
        code: "account_mismatch",
        error: "That email does not match the account you are signed in with.",
        maskedSessionEmail: maskPatientEmail(sessionEmail),
        maskedEnteredEmail: maskPatientEmail(email),
      },
      { status: 409 }
    );
  }

  // (e) Email already registered + anonymous / no permanent email → handoff for sign-in.
  const probe = await isAuthEmailInUse(admin, email, user.id);
  if (!probe.probeError && probe.inUse) {
    const handoff = await createIntakeCaseHandoff({
      admin,
      caseId,
      fromOwnerId: user.id,
      intendedEmail: email,
      pathway,
    });
    if (!handoff.ok) {
      console.error(CLAIM_ACCOUNT_LOG_PREFIX, "handoff create failed", handoff.logContext);
      return NextResponse.json(
        {
          ok: false,
          error: EMAIL_EXISTS_CLAIM_ERROR,
          code: "email_exists",
          correlationId: handoff.correlationId,
        },
        { status: 409 }
      );
    }

    logIntakeAuthDiagnostic({
      authStateSource: "claim_account",
      authenticatedUserId: user.id,
      caseId,
      pathway,
      ownershipResult: "email_exists_handoff",
      intendedReturnRoute: handoff.returnPath,
      redirectReason: "sign_in_required",
      correlationId: handoff.correlationId,
      isAnonymous: anonymous,
      emailMatched: false,
    });

    return NextResponse.json(
      {
        ok: false,
        error: EMAIL_EXISTS_CLAIM_ERROR,
        code: "email_exists",
        correlationId: handoff.correlationId,
        signInHref: handoff.signInHref,
        returnPath: handoff.returnPath,
        maskedEmail: handoff.maskedEmail,
        requiresSignOut: anonymous,
      },
      { status: 409 }
    );
  }

  // Fresh email on anonymous (or email-less) session — same-uid upgrade.
  const result = await claimAnonymousAccount({
    admin,
    userId: user.id,
    caseId,
    email,
    firstName,
    userMetadata: user.user_metadata as Record<string, unknown> | undefined,
  });

  if (!result.ok) {
    if (result.code === "email_exists") {
      const handoff = await createIntakeCaseHandoff({
        admin,
        caseId,
        fromOwnerId: user.id,
        intendedEmail: email,
        pathway,
        correlationId: result.correlationId,
      });
      return NextResponse.json(
        {
          ok: false,
          error: EMAIL_EXISTS_CLAIM_ERROR,
          code: "email_exists",
          correlationId: result.correlationId,
          signInHref: handoff.ok ? handoff.signInHref : undefined,
          returnPath: handoff.ok ? handoff.returnPath : undefined,
          maskedEmail: handoff.ok ? handoff.maskedEmail : undefined,
          requiresSignOut: true,
        },
        { status: 409 }
      );
    }
    console.error(CLAIM_ACCOUNT_LOG_PREFIX, "claim failed", result.logContext);
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        code: result.code,
        correlationId: result.correlationId,
      },
      { status: result.status }
    );
  }

  await admin.from("cases").update({ patient_email: email }).eq("id", caseId);

  console.info(CLAIM_ACCOUNT_LOG_PREFIX, "anonymous account claimed", {
    userId: result.userId,
    caseId: result.caseId,
    correlationId: result.correlationId,
  });

  logIntakeAuthDiagnostic({
    authStateSource: "claim_account",
    authenticatedUserId: result.userId,
    caseId: result.caseId,
    pathway,
    ownershipResult: "claimed_same_uid",
    intendedReturnRoute: patientReviewPath(caseId),
    correlationId: result.correlationId,
    isAnonymous: false,
  });

  return NextResponse.json({
    ok: true,
    correlationId: result.correlationId,
    next: patientReviewPath(caseId),
    code: "claimed",
  });
}
