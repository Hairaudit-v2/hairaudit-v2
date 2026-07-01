import { NextResponse } from "next/server";

import { validateAccountClaimToken } from "@/lib/nexus/accountClaim.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientKeyFromHeaders, rateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

const VALIDATE_LIMIT = 30;
const VALIDATE_WINDOW_MS = 60_000;

export async function GET(req: Request) {
  const clientKey = clientKeyFromHeaders(req.headers);
  const limited = rateLimit(`nexus-claim-validate:${clientKey}`, VALIDATE_LIMIT, VALIDATE_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { valid: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } }
    );
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ valid: false, reason: "malformed" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const result = await validateAccountClaimToken(admin, token);
  return NextResponse.json(result, { status: result.valid ? 200 : 404 });
}
