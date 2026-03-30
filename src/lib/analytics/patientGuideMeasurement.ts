/**
 * Shared helpers for patient-guides hub and patient-intent article measurement.
 * GTM (or similar) can use click triggers on [data-cta], read data-patient-guide / data-hub-card-slug, etc.
 */

/** True when an in-content markdown href targets the request-review funnel. */
export function isPatientGuideRequestReviewHref(href: string): boolean {
  const t = href.trim();
  if (!t) return false;
  let pathname: string;
  if (t.startsWith("http://") || t.startsWith("https://")) {
    try {
      pathname = new URL(t).pathname;
    } catch {
      return false;
    }
  } else {
    pathname = t.split("#")[0].split("?")[0];
    if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  }
  return pathname === "/request-review";
}
