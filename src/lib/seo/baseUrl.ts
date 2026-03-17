import { SITE_URL } from "@/lib/constants";

/**
 * Canonical base URL for the site (no trailing slash).
 * Matches the resolution used in layout metadata and sitemap.
 */
export function getBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? SITE_URL;
  return typeof url === "string" ? url.replace(/\/+$/, "") : SITE_URL;
}
