/**
 * Auth funnel measurement — pushes to dataLayer (GTM) and dispatches hairaudit:auth_funnel.
 * dataLayer objects use event: "hairaudit:auth_funnel" for GTM Custom Event triggers;
 * auth_funnel_stage carries the stable stage id for drop-off analysis.
 */

import { readStoredAuthAttribution } from "@/lib/analytics/authAttribution";

export const AUTH_FUNNEL_STAGES = [
  "auth_page_view",
  "auth_email_submit",
  "auth_magic_link_sent",
  "auth_magic_link_send_failed",
  "auth_callback_view",
  "auth_session_success",
  "auth_session_failed",
  "auth_dashboard_redirect_success",
] as const;

export type AuthFunnelStage = (typeof AUTH_FUNNEL_STAGES)[number];

export type AuthFunnelContext = {
  /** Current pathname including leading slash */
  path: string;
  /** Current location search string (includes "?" or empty) */
  path_search: string;
  /** document.referrer when available */
  referrer: string | null;
  /** Last recorded non-auth path+search from AuthAttributionRecorder */
  prior_page: string | null;
  /** True if prior path or referrer indicates /request-review */
  from_request_review: boolean;
  /** Last TrackedLink event stashed when navigating to /login or /signup */
  cta_event: string | null;
  cta_href: string | null;
};

export function buildAuthFunnelContext(pathname: string, search: string): AuthFunnelContext {
  if (typeof window === "undefined") {
    return {
      path: pathname,
      path_search: search,
      referrer: null,
      prior_page: null,
      from_request_review: false,
      cta_event: null,
      cta_href: null,
    };
  }

  const { prior_page, cta_event, cta_href } = readStoredAuthAttribution();
  const referrer = document.referrer || null;
  const fromReview = isFromRequestReview(prior_page, referrer, pathname, search);

  return {
    path: pathname,
    path_search: search,
    referrer,
    prior_page,
    from_request_review: fromReview,
    cta_event,
    cta_href,
  };
}

function isFromRequestReview(
  priorPage: string | null,
  referrer: string | null,
  pathname: string,
  search: string
): boolean {
  const pathsToCheck: string[] = [];
  if (priorPage) pathsToCheck.push(priorPage.split("?")[0]);
  if (referrer) {
    try {
      pathsToCheck.push(new URL(referrer).pathname);
    } catch {
      /* ignore */
    }
  }
  pathsToCheck.push(pathname);

  try {
    const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (q.get("from") === "request_review" || q.get("source") === "request_review") return true;
  } catch {
    /* ignore */
  }

  for (const p of pathsToCheck) {
    if (p === "/request-review" || p.startsWith("/request-review/")) return true;
  }
  return false;
}

export function trackAuthFunnel(
  stage: AuthFunnelStage,
  extra?: Record<string, unknown>,
  pathContext?: { pathname: string; search: string }
) {
  if (typeof window === "undefined") return;

  const pathname = pathContext?.pathname ?? window.location.pathname;
  const search = pathContext?.search ?? window.location.search;
  const base = buildAuthFunnelContext(pathname, search);

  const payload: Record<string, unknown> = {
    auth_funnel_stage: stage,
    auth_path: base.path,
    auth_path_search: base.path_search,
    auth_referrer: base.referrer,
    auth_prior_page: base.prior_page,
    auth_from_request_review: base.from_request_review,
    ...(base.cta_event ? { auth_cta_event: base.cta_event } : {}),
    ...(base.cta_href ? { auth_cta_href: base.cta_href } : {}),
    ...extra,
    event: "hairaudit:auth_funnel",
  };

  const w = window as typeof window & { dataLayer?: Array<Record<string, unknown>> };
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push(payload);
  }

  window.dispatchEvent(new CustomEvent("hairaudit:auth_funnel", { detail: payload }));
}
