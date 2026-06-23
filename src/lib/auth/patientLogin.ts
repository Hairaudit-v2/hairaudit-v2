import type { SupabaseClient } from "@supabase/supabase-js";
import { browserPathAfterLoginSession } from "@/lib/academy/postLoginRedirect";
import { sanitizeNextPath } from "@/lib/auth/redirects";

/** Canonical patient login surface — never `/login/auditor`. */
export const PATIENT_LOGIN_PATH = "/login";

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
