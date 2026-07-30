import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAuditCase } from "@/lib/cases/createCase";
import { verifyHcaptchaToken } from "@/lib/security/hcaptcha";
import { rateLimit, clientKeyFromHeaders } from "@/lib/security/rateLimit";
import {
  MISSING_PATIENT_REVIEW_PATHWAY_ERROR,
  parseExplicitPatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import {
  DONOR_HEALING_ENTRY_CONTEXT,
  parseDonorEntryContext,
  parsePostSurgeryConcern,
} from "@/lib/patient/donorHealingEntry";

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

function isMissingAuthSession(error: { message?: string; name?: string } | null): boolean {
  if (!error) return false;
  return (
    error.name === "AuthSessionMissingError" ||
    /auth session missing/i.test(error.message ?? "")
  );
}

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
  const pathway = parseExplicitPatientReviewPathway(body?.pathway ?? body?.audit_type);
  if (!pathway) {
    return NextResponse.json(
      { ok: false, error: MISSING_PATIENT_REVIEW_PATHWAY_ERROR },
      { status: 400 }
    );
  }
  const captcha = await verifyHcaptchaToken(captchaToken, clientKey);
  if (!captcha.ok) {
    return NextResponse.json(
      { ok: false, error: "Verification failed. Please retry." },
      { status: 400 }
    );
  }

  // 3) Resolve auth session — reuse an existing login when present; otherwise create
  //    an anonymous session for friction-free entry (no signup).
  let supabaseAuth;
  try {
    supabaseAuth = await createSupabaseAuthServerClient();
  } catch (e) {
    console.error(LOG_PREFIX, "createSupabaseAuthServerClient failed", { error: e });
    return NextResponse.json({ ok: false, error: "Auth unavailable" }, { status: 500 });
  }

  const {
    data: { user: existingUser },
    error: existingUserError,
  } = await supabaseAuth.auth.getUser();

  if (existingUserError && !isMissingAuthSession(existingUserError)) {
    console.error(LOG_PREFIX, "getUser failed", {
      error: existingUserError.message,
      code: existingUserError.code,
    });
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  let sessionUser = existingUserError ? null : existingUser;
  if (!sessionUser) {
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
    sessionUser = anon.user;
  }

  const userId = sessionUser.id;

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
    userEmail: sessionUser.email,
    userMetadata: sessionUser.user_metadata as Record<string, unknown> | undefined,
    devRoleCookieValue: null,
    nodeEnv: process.env.NODE_ENV,
    patientReviewPathway: pathway,
  });

  if (!result.ok) {
    console.error(LOG_PREFIX, "createAuditCase failed", { userId, ...result.logContext, error: result.error });
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  // HA-DONOR-HEALING-1A — persist validated donor entry context on draft report summary
  // (survives auth claim / resume). Never logs health answers or image URLs.
  const entryContext =
    pathway === "post_surgery"
      ? parseDonorEntryContext(body?.entryContext ?? body?.entry_context ?? body?.concern)
      : null;
  const concern =
    pathway === "post_surgery" ? parsePostSurgeryConcern(body?.concern) : null;
  const entrySource =
    typeof body?.entry_source === "string" && body.entry_source.trim()
      ? body.entry_source.trim().slice(0, 120)
      : null;

  if (entryContext) {
    const seedAnswers: Record<string, unknown> = {
      entry_context: entryContext,
      ...(concern ? { primary_donor_concern: concern } : { primary_donor_concern: "donor_healing" }),
    };
    const summary = {
      entry_context: entryContext,
      entry_source: entrySource,
      primary_donor_concern: concern ?? "donor_healing",
      patient_answers: seedAnswers,
      patient_answers_updated_at: new Date().toISOString(),
    };
    const { error: seedErr } = await supabaseAdmin.from("reports").insert({
      case_id: result.caseId,
      version: 1,
      summary,
      pdf_path: "",
      patient_audit_version: 2,
      patient_audit_v2: seedAnswers,
    });
    if (seedErr) {
      // Non-fatal: case still usable; questionnaire can seed later.
      console.info(LOG_PREFIX, "entry context seed skipped", {
        caseId: result.caseId,
        entry_context: entryContext,
        reason: seedErr.message,
      });
    }
  }

  console.info(LOG_PREFIX, "audit started", {
    userId,
    caseId: result.caseId,
    pathway,
    entry_context: entryContext ?? null,
    reusedSession: Boolean(existingUser),
  });
  return NextResponse.json({
    ok: true,
    caseId: result.caseId,
    pathway,
    entryContext: entryContext ?? null,
    next:
      entryContext === DONOR_HEALING_ENTRY_CONTEXT
        ? `/cases/${result.caseId}/patient/photos?entry_context=donor_healing`
        : `/cases/${result.caseId}/patient/photos`,
  });
}
