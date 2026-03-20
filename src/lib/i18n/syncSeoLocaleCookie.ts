"use client";

import { SEO_LOCALE_COOKIE_NAME, type SupportedLocale } from "@/lib/i18n/constants";

const MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** Keep `generateMetadata` cookie in sync with {@link LOCALE_STORAGE_KEY} preference. */
export function syncSeoLocaleCookie(locale: SupportedLocale) {
  document.cookie = `${SEO_LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${MAX_AGE_SEC}; SameSite=Lax`;
}

export function clearSeoLocaleCookie() {
  document.cookie = `${SEO_LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
}
