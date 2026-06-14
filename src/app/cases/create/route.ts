/**
 * Legacy path `POST /cases/create` — delegates to the same service as `POST /api/cases/create`
 * so behaviour cannot drift. Prefer the `/api` route for new clients.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAuditCase } from "@/lib/cases/createCase";

export async function POST() {
  const supabaseAuth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Server configuration error" }, { status: 500 });
  }

  let devRoleCookieValue: string | null = null;
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    devRoleCookieValue = cookieStore.get("dev_role")?.value ?? null;
  }

  const result = await createAuditCase({
    admin: supabaseAdmin,
    userId: user.id,
    userMetadata: user.user_metadata as Record<string, unknown> | undefined,
    devRoleCookieValue,
    nodeEnv: process.env.NODE_ENV,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, caseId: result.caseId });
}
