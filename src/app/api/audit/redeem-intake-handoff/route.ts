import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  INTAKE_OWNERSHIP_LOG_PREFIX,
  logIntakeAuthDiagnostic,
  redeemIntakeCaseHandoff,
} from "@/lib/patient/intakeCaseOwnership";
import { isMalformedIntakeHandoffToken } from "@/lib/patient/intakeCaseHandoffToken";

/**
 * POST /api/audit/redeem-intake-handoff
 *
 * After existing-account sign-in, redeem the handoff token to attach the
 * unfinished intake case to the authenticated patient (idempotent).
 */

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token || isMalformedIntakeHandoffToken(token)) {
    return NextResponse.json({ ok: false, error: "Invalid handoff token.", code: "invalid_token" }, { status: 400 });
  }

  let supabaseAuth;
  try {
    supabaseAuth = await createSupabaseAuthServerClient();
  } catch (e) {
    console.error(INTAKE_OWNERSHIP_LOG_PREFIX, "auth client failed", { error: e });
    return NextResponse.json({ ok: false, error: "Auth unavailable" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in to continue.", code: "session_missing" }, { status: 401 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    console.error(INTAKE_OWNERSHIP_LOG_PREFIX, "admin client failed", { error: e });
    return NextResponse.json({ ok: false, error: "Server configuration error" }, { status: 500 });
  }

  const result = await redeemIntakeCaseHandoff({
    admin,
    plaintextToken: token,
    claimantUserId: user.id,
    claimantEmail: user.email,
  });

  logIntakeAuthDiagnostic({
    authStateSource: "handoff_redeem",
    authenticatedUserId: user.id,
    caseId: result.ok ? result.caseId : null,
    pathway: result.ok ? result.pathway : null,
    intendedReturnRoute: result.ok ? result.returnPath : null,
    ownershipResult: result.ok
      ? result.transferred
        ? "transferred"
        : result.alreadyOwned
          ? "already_owned"
          : "redeemed"
      : result.code,
    correlationId: result.correlationId,
    emailMatched: result.ok ? true : result.code === "email_mismatch" ? false : null,
  });

  if (!result.ok) {
    console.error(INTAKE_OWNERSHIP_LOG_PREFIX, "redeem failed", result.logContext);
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

  return NextResponse.json({
    ok: true,
    caseId: result.caseId,
    returnPath: result.returnPath,
    pathway: result.pathway,
    correlationId: result.correlationId,
    transferred: result.transferred,
    alreadyOwned: result.alreadyOwned,
  });
}
