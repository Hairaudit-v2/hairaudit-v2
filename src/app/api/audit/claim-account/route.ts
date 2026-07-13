import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CLAIM_ACCOUNT_LOG_PREFIX,
  EMAIL_RE,
  PATIENT_SAFE_CLAIM_ERROR,
  claimAnonymousAccount,
} from "@/lib/audit/claimAnonymousAccount";

/**
 * POST /api/audit/claim-account
 *
 * Email-collection step of the friction-free first audit ("Where should we send
 * your report?"). Upgrades the current ANONYMOUS user into a permanent account
 * — keeping the SAME uid, so the audit case ownership never changes — and
 * records the email + first name so the report-ready and verification emails
 * have a recipient.
 *
 * Does NOT send the verification email here: that is dispatched after report
 * generation (see the report-completion Inngest step), so value is delivered
 * before any friction.
 *
 * Body: { caseId: string, email: string, firstName?: string }
 */

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const caseId = typeof body?.caseId === "string" ? body.caseId.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
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
    return NextResponse.json(
      { ok: false, error: "Your session has expired. Please start again." },
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

  const result = await claimAnonymousAccount({
    admin,
    userId: user.id,
    caseId,
    email,
    firstName,
    userMetadata: user.user_metadata as Record<string, unknown> | undefined,
  });

  if (!result.ok) {
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

  console.info(CLAIM_ACCOUNT_LOG_PREFIX, "anonymous account claimed", {
    userId: result.userId,
    caseId: result.caseId,
    correlationId: result.correlationId,
  });
  return NextResponse.json({ ok: true, correlationId: result.correlationId });
}

/** Patient-safe message export for tests (no auth details). */
export { PATIENT_SAFE_CLAIM_ERROR };
