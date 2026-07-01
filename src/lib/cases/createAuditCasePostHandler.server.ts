import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAuditCase } from "@/lib/cases/createCase";
import {
  MISSING_PATIENT_REVIEW_PATHWAY_ERROR,
  normalizePatientReviewPathway,
  parseExplicitPatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import {
  effectiveAuditCaseCreationRole,
  resolveCaseCreationRole,
} from "@/lib/cases/createCase";

/**
 * Shared implementation for `POST /api/cases/create` and legacy `POST /cases/create`.
 * Keeps status codes, JSON shape, and logging aligned so fixes stay single-sourced.
 */
const LOG_PREFIX = "[cases/create]";

export async function handlePostCreateAuditCaseRoute(req?: Request): Promise<NextResponse> {
  let supabaseAuth;
  try {
    supabaseAuth = await createSupabaseAuthServerClient();
  } catch (e) {
    console.error(LOG_PREFIX, "createSupabaseAuthServerClient failed", { error: e });
    return NextResponse.json({ ok: false, error: "Auth unavailable" }, { status: 500 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError) {
    console.error(LOG_PREFIX, "getUser error", { error: userError.message, code: userError.code });
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  if (!user) {
    console.error(LOG_PREFIX, "no user in session");
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;
  console.info(LOG_PREFIX, "authenticated user", { userId });

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (e) {
    console.error(LOG_PREFIX, "createSupabaseAdminClient failed", { userId, error: e });
    return NextResponse.json({ ok: false, error: "Server configuration error" }, { status: 500 });
  }

  let devRoleCookieValue: string | null = null;
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    devRoleCookieValue = cookieStore.get("dev_role")?.value ?? null;
  }

  let patientReviewPathway: ReturnType<typeof normalizePatientReviewPathway> | undefined;
  if (req) {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const explicitPathway = parseExplicitPatientReviewPathway(body?.pathway ?? body?.audit_type);

    const rawRole = await resolveCaseCreationRole({
      admin: supabaseAdmin,
      userId,
      userMetadata: user.user_metadata as Record<string, unknown> | undefined,
      devRoleCookieValue,
      nodeEnv: process.env.NODE_ENV,
    });
    const effectiveRole = effectiveAuditCaseCreationRole(rawRole);

    if (effectiveRole === "patient" && !explicitPathway) {
      return NextResponse.json(
        { ok: false, error: MISSING_PATIENT_REVIEW_PATHWAY_ERROR },
        { status: 400 }
      );
    }

    patientReviewPathway = explicitPathway ?? undefined;
  }

  const result = await createAuditCase({
    admin: supabaseAdmin,
    userId,
    userEmail: user.email,
    userMetadata: user.user_metadata as Record<string, unknown> | undefined,
    devRoleCookieValue,
    nodeEnv: process.env.NODE_ENV,
    patientReviewPathway,
  });

  if (!result.ok) {
    if (result.status >= 500) {
      console.error(LOG_PREFIX, "createAuditCase failed", { userId, ...result.logContext, error: result.error });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, caseId: result.caseId });
}
