import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createResponseCookieSupabaseClient } from "@/lib/supabase/auth-callback-client";
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
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import { dashboardPathForRole } from "@/lib/auth/redirects";
import {
  authReturnPathForPathway,
  classifyPathwayStartActor,
  logPathwayStart,
  photosStepForCase,
  professionalRoleBlock,
} from "@/lib/patient/pathwayStart";
import {
  findResumablePatientDraft,
  provisionPatientProfileForPathwayStart,
} from "@/lib/patient/pathwayStart.server";

/**
 * POST /api/audit/start
 *
 * Friction-free entry for pathway A/B: reuses a session when present, otherwise
 * creates an anonymous Supabase session, then creates or resumes a draft case.
 *
 * HA-PATHWAY-START-403-FIX: professionals/auditors get structured ROLE_NOT_ALLOWED
 * (never raw "Forbidden"). Missing patient profiles are provisioned explicitly
 * for pathway start. Incomplete same-pathway drafts are resumed (409 EXISTING_CASE).
 * Anonymous session cookies are written onto the JSON response.
 */

const LOG_PREFIX = "[audit/start]";

function isMissingAuthSession(error: { message?: string; name?: string } | null): boolean {
  if (!error) return false;
  return (
    error.name === "AuthSessionMissingError" ||
    /auth session missing/i.test(error.message ?? "")
  );
}

const START_LIMIT = 5;
const START_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientKey = clientKeyFromHeaders(req.headers);
  const { supabase: supabaseAuth, applyCookies } = createResponseCookieSupabaseClient(req);
  const json = (body: Record<string, unknown>, init?: { status?: number; headers?: HeadersInit }) =>
    applyCookies(NextResponse.json(body, init));

  const limited = rateLimit(`audit-start:${clientKey}`, START_LIMIT, START_WINDOW_MS);
  if (!limited.ok) {
    return json(
      { ok: false, error: "Too many audits started. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } }
    );
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const captchaToken = typeof body?.captchaToken === "string" ? body.captchaToken : null;
  const pathway = parseExplicitPatientReviewPathway(body?.pathway ?? body?.audit_type);
  if (!pathway) {
    return json({ ok: false, error: MISSING_PATIENT_REVIEW_PATHWAY_ERROR }, { status: 400 });
  }
  const captcha = await verifyHcaptchaToken(captchaToken, clientKey);
  if (!captcha.ok) {
    return json({ ok: false, error: "Verification failed. Please retry." }, { status: 400 });
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
    const next = buildPatientLoginHref(authReturnPathForPathway(pathway));
    logPathwayStart({
      pathname: "/api/audit/start",
      pathway,
      authUserPresent: false,
      profilePresent: false,
      resolvedRole: null,
      existingCasePresent: false,
      authorizationDecision: "deny",
      redirectDecision: next,
      rejectionReason: "invalid_session",
    });
    return json(
      { ok: false, error: "UNAUTHORIZED", code: "UNAUTHORIZED", pathway, next },
      { status: 401 }
    );
  }

  let sessionUser = existingUserError ? null : existingUser;
  let createdAnonymous = false;

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (e) {
    console.error(LOG_PREFIX, "createSupabaseAdminClient failed", { error: e });
    return json({ ok: false, error: "Server configuration error" }, { status: 500 });
  }

  // Classify any existing session before creating anonymous (professionals must not get patient drafts).
  if (sessionUser) {
    const { data: earlyProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", sessionUser.id)
      .maybeSingle();
    const early = classifyPathwayStartActor({
      user: sessionUser,
      profileRole: earlyProfile?.role,
    });
    const block = professionalRoleBlock({
      authClass: early.authClass,
      resolvedRole: early.resolvedRole,
      pathway,
    });
    if (block) {
      logPathwayStart({
        pathname: "/api/audit/start",
        pathway,
        authUserPresent: true,
        profilePresent: early.profilePresent,
        resolvedRole: early.resolvedRole,
        existingCasePresent: false,
        authorizationDecision: "deny",
        redirectDecision: block.next,
        rejectionReason: block.code,
      });
      return json(
        {
          ok: false,
          error: block.code,
          code: block.code,
          pathway,
          next: block.next,
          message: block.message,
        },
        { status: 403 }
      );
    }
  }

  if (!sessionUser) {
    const { data: anon, error: anonError } = await supabaseAuth.auth.signInAnonymously();
    if (anonError || !anon?.user) {
      console.error(LOG_PREFIX, "signInAnonymously failed", {
        error: anonError?.message,
        code: anonError?.code,
      });
      const loginNext = buildPatientLoginHref(authReturnPathForPathway(pathway));
      const msg =
        anonError?.code === "anonymous_provider_disabled" || /anonymous/i.test(anonError?.message ?? "")
          ? "Anonymous sign-in is not enabled. Please sign in to continue."
          : "Could not start your audit. Please try again.";
      logPathwayStart({
        pathname: "/api/audit/start",
        pathway,
        authUserPresent: false,
        profilePresent: false,
        resolvedRole: null,
        existingCasePresent: false,
        authorizationDecision: "deny",
        redirectDecision: loginNext,
        rejectionReason: anonError?.code ?? "anonymous_signin_failed",
      });
      return json(
        {
          ok: false,
          error: anonError?.code === "anonymous_provider_disabled" ? "UNAUTHORIZED" : msg,
          code: anonError?.code === "anonymous_provider_disabled" ? "UNAUTHORIZED" : undefined,
          pathway,
          next: loginNext,
          message: msg,
        },
        { status: anonError?.code === "anonymous_provider_disabled" ? 401 : 500 }
      );
    }
    sessionUser = anon.user;
    createdAnonymous = true;
  }

  const userId = sessionUser.id;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const classified = classifyPathwayStartActor({
    user: sessionUser,
    profileRole: profile?.role,
  });

  // Authenticated permanent user with no profile: provision patient for pathway start only.
  if (classified.authClass === "authenticated_no_profile") {
    const provisioned = await provisionPatientProfileForPathwayStart({
      admin: supabaseAdmin,
      userId,
      email: sessionUser.email,
      displayName:
        typeof (sessionUser.user_metadata as Record<string, unknown> | undefined)?.full_name === "string"
          ? String((sessionUser.user_metadata as Record<string, unknown>).full_name)
          : typeof (sessionUser.user_metadata as Record<string, unknown> | undefined)?.name === "string"
            ? String((sessionUser.user_metadata as Record<string, unknown>).name)
            : null,
    });
    if (!provisioned.ok) {
      const next = `/beta-access-message?pathway=${encodeURIComponent(pathway)}`;
      logPathwayStart({
        pathname: "/api/audit/start",
        pathway,
        authUserPresent: true,
        profilePresent: false,
        resolvedRole: null,
        existingCasePresent: false,
        authorizationDecision: "deny",
        redirectDecision: next,
        rejectionReason: "PROFILE_REQUIRED",
      });
      return json(
        {
          ok: false,
          error: "PROFILE_REQUIRED",
          code: "PROFILE_REQUIRED",
          pathway,
          next,
          message: "Your account needs a patient profile before starting a review.",
        },
        { status: 403 }
      );
    }
    logPathwayStart({
      pathname: "/api/audit/start",
      pathway,
      authUserPresent: true,
      profilePresent: true,
      resolvedRole: "patient",
      existingCasePresent: false,
      authorizationDecision: "provision_then_allow",
      redirectDecision: null,
      rejectionReason: null,
    });
  }

  // Resume incomplete same-pathway draft (no duplicate cases).
  const existing = await findResumablePatientDraft({
    admin: supabaseAdmin,
    userId,
    pathway,
  });
  if (existing) {
    const entryContextEarly =
      pathway === "post_surgery"
        ? parseDonorEntryContext(body?.entryContext ?? body?.entry_context ?? body?.concern)
        : null;
    const next = photosStepForCase(existing.caseId, pathway, entryContextEarly);
    logPathwayStart({
      pathname: "/api/audit/start",
      pathway,
      authUserPresent: true,
      profilePresent: classified.profilePresent || classified.authClass === "authenticated_no_profile",
      resolvedRole: classified.resolvedRole ?? "patient",
      existingCasePresent: true,
      authorizationDecision: "resume",
      redirectDecision: next,
      rejectionReason: "EXISTING_CASE",
    });
    return json(
      {
        ok: false,
        error: "EXISTING_CASE",
        code: "EXISTING_CASE",
        pathway,
        caseId: existing.caseId,
        next,
        message: "You already have an in-progress review. Continuing where you left off.",
      },
      { status: 409 }
    );
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
    const code =
      result.error === "ROLE_NOT_ALLOWED"
        ? "ROLE_NOT_ALLOWED"
        : result.status === 403
          ? "ROLE_NOT_ALLOWED"
          : undefined;
    const next =
      code === "ROLE_NOT_ALLOWED"
        ? dashboardPathForRole(
            classifyPathwayStartActor({
              user: sessionUser,
              profileRole: profile?.role,
            }).resolvedRole
          )
        : null;
    console.error(LOG_PREFIX, "createAuditCase failed", {
      userId,
      ...result.logContext,
      error: result.error,
    });
    logPathwayStart({
      pathname: "/api/audit/start",
      pathway,
      authUserPresent: true,
      profilePresent: Boolean(profile?.role),
      resolvedRole: profile?.role ? String(profile.role) : null,
      existingCasePresent: false,
      authorizationDecision: "deny",
      redirectDecision: next,
      rejectionReason: code ?? result.error,
    });
    return json(
      {
        ok: false,
        error: code ?? result.error,
        code,
        pathway,
        next,
        message:
          code === "ROLE_NOT_ALLOWED"
            ? "This account cannot start a patient review from this pathway."
            : result.error,
      },
      { status: result.status }
    );
  }

  const entryContext =
    pathway === "post_surgery"
      ? parseDonorEntryContext(body?.entryContext ?? body?.entry_context ?? body?.concern)
      : null;
  const concern = pathway === "post_surgery" ? parsePostSurgeryConcern(body?.concern) : null;
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
      console.info(LOG_PREFIX, "entry context seed skipped", {
        caseId: result.caseId,
        entry_context: entryContext,
        reason: seedErr.message,
      });
    }
  }

  const next = photosStepForCase(
    result.caseId,
    pathway,
    entryContext === DONOR_HEALING_ENTRY_CONTEXT ? entryContext : null
  );

  logPathwayStart({
    pathname: "/api/audit/start",
    pathway,
    authUserPresent: true,
    profilePresent: classified.profilePresent || classified.authClass === "authenticated_no_profile",
    resolvedRole: classified.resolvedRole ?? "patient",
    existingCasePresent: false,
    authorizationDecision: "allow",
    redirectDecision: next,
    rejectionReason: null,
  });

  console.info(LOG_PREFIX, "audit started", {
    userId,
    caseId: result.caseId,
    pathway,
    entry_context: entryContext ?? null,
    reusedSession: Boolean(existingUser) && !createdAnonymous,
    createdAnonymous,
  });

  return json({
    ok: true,
    caseId: result.caseId,
    pathway,
    entryContext: entryContext ?? null,
    next,
  });
}
