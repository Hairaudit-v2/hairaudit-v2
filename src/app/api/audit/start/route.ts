import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAuditCase } from "@/lib/cases/createCase";
import { verifyHcaptchaToken } from "@/lib/security/hcaptcha";
import { rateLimit, clientKeyFromHeaders } from "@/lib/security/rateLimit";
import { normalizePatientReviewPathway } from "@/lib/patient/patientReviewPathway";

/**
 * POST /api/audit/start
 *
 * Friction-free entry point for the first patient audit. Creates an ANONYMOUS
 * Supabase auth session server-side (no signup), then a draft patient audit
 * case owned by that anonymous user, and returns the caseId so the client can
 * navigate straight to the photo-upload step.
 *
 * The anonymous user is later upgraded to a permanent account at the email
 * collection step (`/api/audit/claim-account`) — keeping the same uid, so the
 * case ownership never needs to be migrated.
 *
 * Abuse control: per-IP rate limiting + optional hCaptcha (enabled when
 * HCAPTCHA_SECRET is set).
 */

const LOG_PREFIX = "[audit/start]";

// Allow a small burst of new anonymous audits per IP per window.
const START_LIMIT = 5;
const START_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request): Promise<NextResponse> {
  const clientKey = clientKeyFromHeaders(req.headers);

  // 1) Rate limit
  const limited = rateLimit(`audit-start:${clientKey}`, START_LIMIT, START_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many audits started. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } }
    );
  }

  // 2) hCaptcha (no-op unless configured)
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const captchaToken = typeof body?.captchaToken === "string" ? body.captchaToken : null;
  const pathway = normalizePatientReviewPathway(body?.pathway ?? body?.audit_type);
  const captcha = await verifyHcaptchaToken(captchaToken, clientKey);
  if (!captcha.ok) {
    return NextResponse.json(
      { ok: false, error: "Verification failed. Please retry." },
      { status: 400 }
    );
  }

  // 3) Create anonymous session (server-side; sets auth cookies on the response)
  let supabaseAuth;
  try {
    supabaseAuth = await createSupabaseAuthServerClient();
  } catch (e) {
    console.error(LOG_PREFIX, "createSupabaseAuthServerClient failed", { error: e });
    return NextResponse.json({ ok: false, error: "Auth unavailable" }, { status: 500 });
  }

  const { data: anon, error: anonError } = await supabaseAuth.auth.signInAnonymously();
  if (anonError || !anon?.user) {
    console.error(LOG_PREFIX, "signInAnonymously failed", {
      error: anonError?.message,
      code: anonError?.code,
    });
    const msg =
      anonError?.code === "anonymous_provider_disabled" || /anonymous/i.test(anonError?.message ?? "")
        ? "Anonymous sign-in is not enabled. Please contact support."
        : "Could not start your audit. Please try again.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const userId = anon.user.id;

  // 4) Create the draft patient audit case (reuses canonical creation logic)
  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (e) {
    console.error(LOG_PREFIX, "createSupabaseAdminClient failed", { userId, error: e });
    return NextResponse.json({ ok: false, error: "Server configuration error" }, { status: 500 });
  }

  const result = await createAuditCase({
    admin: supabaseAdmin,
    userId,
    userMetadata: anon.user.user_metadata as Record<string, unknown> | undefined,
    devRoleCookieValue: null,
    nodeEnv: process.env.NODE_ENV,
    patientReviewPathway: pathway,
  });

  if (!result.ok) {
    console.error(LOG_PREFIX, "createAuditCase failed", { userId, ...result.logContext, error: result.error });
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  console.info(LOG_PREFIX, "anonymous audit started", { userId, caseId: result.caseId, pathway });
  return NextResponse.json({
    ok: true,
    caseId: result.caseId,
    pathway,
    next: `/cases/${result.caseId}/patient/photos`,
  });
}
