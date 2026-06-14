import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAuditCase } from "@/lib/cases/createCase";

const LOG_PREFIX = "[api/cases/create]";

export async function POST() {
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

  const result = await createAuditCase({
    admin: supabaseAdmin,
    userId,
    userMetadata: user.user_metadata as Record<string, unknown> | undefined,
    devRoleCookieValue,
    nodeEnv: process.env.NODE_ENV,
  });

  if (!result.ok) {
    if (result.status >= 500) {
      console.error(LOG_PREFIX, "createAuditCase failed", { userId, ...result.logContext, error: result.error });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, caseId: result.caseId });
}
