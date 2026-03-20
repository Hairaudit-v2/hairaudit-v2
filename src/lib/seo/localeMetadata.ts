import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, SEO_LOCALE_COOKIE_NAME, type SupportedLocale } from "@/lib/i18n/constants";
import { getTranslation } from "@/lib/i18n/getTranslation";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { createPageMetadata } from "./pageMetadata";
import { buildPublicLocaleLanguageAlternates, createPublicLocaleRoutingPlan } from "./publicLocaleRouting";

export type LocalizedPageMetaKeys = {
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  pathname: string;
  noindex?: boolean;
};

/**
 * Build Next.js metadata from translation keys. Missing non-English strings fall back to English
 * via {@link getTranslation}.
 */
export function createLocalizedPageMetadata(locale: SupportedLocale, keys: LocalizedPageMetaKeys): Metadata {
  const title = getTranslation(keys.titleKey, locale);
  const description = getTranslation(keys.descriptionKey, locale);
  const localeRouting = createPublicLocaleRoutingPlan(keys.pathname);
  return createPageMetadata({
    title,
    description,
    pathname: keys.pathname,
    canonicalPathname: localeRouting.canonicalPathname,
    languageAlternates: buildPublicLocaleLanguageAlternates(localeRouting),
    noindex: keys.noindex,
  });
}

/**
 * Infer visitor locale for public SEO metadata: prefers the locale cookie (mirrors client
 * `LOCALE_STORAGE_KEY`), then `Accept-Language`. Defaults to English.
 */
export async function resolvePublicSeoLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SEO_LOCALE_COOKIE_NAME)?.value;
  if (raw) {
    try {
      const decoded = decodeURIComponent(raw);
      if (isSupportedLocale(decoded)) return decoded;
    } catch {
      /* ignore malformed cookie */
    }
  }

  const h = await headers();
  return localeFromAcceptLanguage(h.get("accept-language"));
}

/** Exported for unit tests — first supported language tag wins; default English. */
export function localeFromAcceptLanguage(header: string | null | undefined): SupportedLocale {
  if (header == null || header.trim() === "") return DEFAULT_LOCALE;

  const parts = header.split(",").map((part) => part.trim().split(";")[0].trim().toLowerCase());
  for (const p of parts) {
    if (p === "es" || p.startsWith("es-")) return "es";
    if (p === "en" || p.startsWith("en-")) return DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

/**
 * Future hreflang / canonical expansion remains scaffold-only until locale-distinct public URLs
 * exist. Use `publicLocaleRouting.ts` to centralize path mapping and keep English canonical.
 * - Localized OG/Twitter: pass translated title/description into {@link createPageMetadata} (already
 *   wired when using {@link createLocalizedPageMetadata}).
 *
 * See `docs/i18n-seo-discoverability.md`.
 */
export type SeoAlternatesPlan = {
  canonicalPathname: string;
  /** When locale routes exist: map RFC 5646 language tags to absolute URLs */
  hreflangUrls?: Record<string, string>;
};
