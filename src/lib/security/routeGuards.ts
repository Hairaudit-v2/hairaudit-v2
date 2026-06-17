import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAuditor, type AuthResult } from "@/lib/auth/permissions";
import { isProductionRuntime } from "@/lib/security/secrets";

/** Returns 404 in production so dev-only endpoints are not advertised. */
export function blockIfProduction(): NextResponse | null {
  if (isProductionRuntime()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

/**
 * Gates debug/seed/dev helper routes:
 * - production: 404
 * - non-production: authenticated auditor required
 */
export async function requireDevRouteAccess(): Promise<
  AuthResult<{ userId: string; userEmail: string | undefined }>
> {
  const blocked = blockIfProduction();
  if (blocked) {
    return { ok: false, response: blocked };
  }

  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const auditor = await requireAuditor({ userId: user.id, userEmail: user.email ?? undefined });
  if (!auditor.ok) return auditor;
  return { ok: true, data: { userId: user.id, userEmail: user.email ?? undefined } };
}
