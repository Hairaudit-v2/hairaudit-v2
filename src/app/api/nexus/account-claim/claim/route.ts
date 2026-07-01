import { NextResponse } from "next/server";

import { claimAccountWithToken } from "@/lib/nexus/accountClaim.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { clientKeyFromHeaders, rateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

const CLAIM_LIMIT = 10;
const CLAIM_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const clientKey = clientKeyFromHeaders(req.headers);
  const limited = rateLimit(`nexus-claim-post:${clientKey}`, CLAIM_LIMIT, CLAIM_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } }
    );
  }

  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Claim token is required." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const result = await claimAccountWithToken(admin, {
    token,
    userId: user.id,
    userEmail: user.email,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.httpStatus });
  }

  if (result.subjectType === "clinic") {
    return NextResponse.json({
      ok: true,
      subjectType: "clinic",
      clinicProfileId: result.clinicProfileId,
    });
  }

  return NextResponse.json({
    ok: true,
    subjectType: "doctor",
    doctorProfileId: result.doctorProfileId,
  });
}
