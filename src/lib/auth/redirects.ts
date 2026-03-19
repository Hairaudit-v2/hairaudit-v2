import { SITE_URL } from "@/lib/constants";

/**
 * Canonical app URL for auth redirects. Prefer https in production (hairaudit.com).
 * Use for redirectTo, emailRedirectTo, and any auth link generation.
 */
export function getCanonicalAppUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "").trim();
  const base = raw || SITE_URL;
  try {
    const u = new URL(base);
    if (u.hostname.includes("hairaudit.com") && u.protocol === "http:") u.protocol = "https:";
    // Only use the canonical origin (protocol + host). Env values sometimes
    // include a path (e.g. ".../dashboard"), and keeping that would break
    // Supabase allowlisting for auth redirect URLs.
    return `${u.protocol}//${u.host}`.replace(/\/+$/, "");
  } catch {
    return base.replace(/\/+$/, "");
  }
}

/**
 * Allow only internal relative paths (no protocol, no //, no :).
 * Returns null for invalid or external paths.
 */
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    trimmed === "" ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes(":")
  )
    return null;
  return trimmed;
}

/**
 * Dashboard path for a given role. Used as post-auth destination when next is not provided.
 */
export function dashboardPathForRole(role: string | null | undefined): string {
  if (role === "clinic") return "/dashboard/clinic";
  if (role === "doctor") return "/dashboard/doctor";
  if (role === "auditor") return "/dashboard/auditor";
  return "/dashboard";
}

/**
 * Build full auth redirect URL (e.g. callback, recovery, magic-link) with optional query params.
 */
export function buildAuthRedirectUrl(
  path: string,
  params?: Record<string, string>
): string {
  const base = getCanonicalAppUrl();
  const pathTrimmed = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${pathTrimmed}`;
  if (!params || Object.keys(params).length === 0) return url;
  const search = new URLSearchParams(params).toString();
  return `${url}${url.includes("?") ? "&" : "?"}${search}`;
}

/** Allowed query params when forwarding auth code from homepage to /auth/callback. */
const AUTH_CALLBACK_PARAMS = ["code", "next", "signup_role"] as const;

/**
 * Returns the path+query to redirect to when homepage receives auth params (e.g. ?code=...).
 * Use for homepage auth repair: redirect to /auth/callback with allowed params only.
 * Returns null when there is no code (no redirect).
 */
export function getHomepageAuthRedirectTarget(
  searchParams: Record<string, string | string[] | undefined> | null | undefined
): string | null {
  if (!searchParams) return null;
  const code = searchParams.code;
  const codeStr = typeof code === "string" ? code : Array.isArray(code) ? code[0] : undefined;
  if (!codeStr) return null;
  const forward = new URLSearchParams();
  AUTH_CALLBACK_PARAMS.forEach((key) => {
    const v = searchParams[key];
    if (v != null) forward.set(key, Array.isArray(v) ? String(v[0] ?? "") : String(v));
  });
  return `/auth/callback?${forward.toString()}`;
}
