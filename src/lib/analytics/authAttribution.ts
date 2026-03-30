/**
 * Lightweight session attribution for auth funnel: last public path + optional CTA stash.
 */

const LAST_PUBLIC_PATH_KEY = "hairaudit:last_public_path";
const PENDING_CTA_KEY = "hairaudit:pending_auth_cta";

export function isAuthSurfacePath(pathname: string): boolean {
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/signup")) return true;
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return true;
  return false;
}

function isAuthSignupOrLoginHref(href: string): boolean {
  const t = href.trim();
  if (!t) return false;
  let path: string;
  try {
    if (t.startsWith("http://") || t.startsWith("https://")) {
      const u = new URL(t);
      if (u.origin !== window.location.origin) return false;
      path = u.pathname;
    } else {
      path = t.split("#")[0].split("?")[0];
      if (!path.startsWith("/")) path = `/${path}`;
    }
  } catch {
    return false;
  }
  return path === "/login" || path.startsWith("/login/") || path === "/signup" || path.startsWith("/signup/");
}

/** Call on each client navigation; skips auth routes so "prior" stays meaningful. */
export function recordPublicPathForAuth(pathname: string, search: string): void {
  if (typeof window === "undefined") return;
  if (isAuthSurfacePath(pathname)) return;
  const full = `${pathname}${search || ""}`;
  try {
    sessionStorage.setItem(LAST_PUBLIC_PATH_KEY, full);
  } catch {
    /* private mode / quota */
  }
}

/** When TrackedLink points at login/signup, stash the CTA event for the next auth funnel events. */
export function stashPendingAuthCtaContext(eventName: string, href: string): void {
  if (typeof window === "undefined") return;
  if (!isAuthSignupOrLoginHref(href)) return;
  try {
    sessionStorage.setItem(
      PENDING_CTA_KEY,
      JSON.stringify({ eventName, href, ts: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export type StoredAuthAttribution = {
  prior_page: string | null;
  cta_event: string | null;
  cta_href: string | null;
};

export function readStoredAuthAttribution(): StoredAuthAttribution {
  if (typeof window === "undefined") {
    return { prior_page: null, cta_event: null, cta_href: null };
  }
  let prior_page: string | null = null;
  try {
    prior_page = sessionStorage.getItem(LAST_PUBLIC_PATH_KEY);
  } catch {
    /* ignore */
  }

  let cta_event: string | null = null;
  let cta_href: string | null = null;
  try {
    const raw = sessionStorage.getItem(PENDING_CTA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { eventName?: string; href?: string; ts?: number };
      if (typeof parsed.eventName === "string") cta_event = parsed.eventName;
      if (typeof parsed.href === "string") cta_href = parsed.href;
      // Expire stale stash (e.g. user browsed elsewhere before auth)
      if (typeof parsed.ts === "number" && Date.now() - parsed.ts > 1000 * 60 * 60) {
        cta_event = null;
        cta_href = null;
      }
    }
  } catch {
    /* ignore */
  }

  return { prior_page, cta_event, cta_href };
}
