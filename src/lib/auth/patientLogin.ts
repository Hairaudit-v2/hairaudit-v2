import type { SupabaseClient, User } from "@supabase/supabase-js";
import { browserPathAfterLoginSession } from "@/lib/academy/postLoginRedirect";
import { sanitizeNextPath } from "@/lib/auth/redirects";

/** Canonical patient login surface — never `/login/auditor`. */
export const PATIENT_LOGIN_PATH = "/login";

/**
 * Permanent sessions may auto-redirect from /login. Anonymous / email-less
 * draft sessions must not — they need an explicit sign-in for existing accounts.
 */
export function isPermanentLoginSessionUser(
  user: Pick<User, "email" | "is_anonymous" | "app_metadata"> | null | undefined
): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return false;
  if (String(user.app_metadata?.provider ?? "") === "anonymous") return false;
  return Boolean(String(user.email ?? "").trim());
}

/**
 * Build `/login` with optional return path for patient funnel continuity.
 * `returnTo` must be a sanitized internal path (see {@link sanitizeNextPath}).
 */
export function buildPatientLoginHref(returnTo?: string | null): string {
  const next = sanitizeNextPath(returnTo);
  if (!next) return `${PATIENT_LOGIN_PATH}?from=patient`;
  const params = new URLSearchParams({ from: "patient", next });
  return `${PATIENT_LOGIN_PATH}?${params.toString()}`;
}

/** Resolve post-login destination: explicit `next` wins, then role-aware default. */
export async function resolvePostLoginRedirectPath(
  supabase: SupabaseClient,
  nextParam: string | null | undefined
): Promise<string> {
  const next = sanitizeNextPath(nextParam);
  if (next) return next;
  return browserPathAfterLoginSession(supabase);
}
