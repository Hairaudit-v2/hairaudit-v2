import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/constants";

export const LOCALIZED_PUBLIC_PATHNAMES = ["/", "/how-it-works", "/professionals", "/sample-report"] as const;

export type LocalizedPublicPathname = (typeof LOCALIZED_PUBLIC_PATHNAMES)[number];

export type PublicLocaleRouteStrategy = "unprefixed_single_url" | "prefix_except_default";

export type PublicLocaleRoutingPlan = {
  pathname: string;
  localized: boolean;
  canonicalLocale: SupportedLocale;
  canonicalPathname: string;
  distinctLocaleUrlsReady: boolean;
  strategy: PublicLocaleRouteStrategy;
  localePathnames?: Partial<Record<SupportedLocale, string>>;
};

export type PublicLocaleRoutingPlanInput = {
  localized?: boolean;
  canonicalLocale?: SupportedLocale;
  distinctLocaleUrlsReady?: boolean;
  strategy?: PublicLocaleRouteStrategy;
};

export function isLocalizedPublicPathname(pathname: string): pathname is LocalizedPublicPathname {
  return (LOCALIZED_PUBLIC_PATHNAMES as readonly string[]).includes(normalizePathname(pathname));
}

/**
 * Future helper for locale-distinct public routes. Current runtime keeps one public URL per page,
 * so callers must not emit hreflang tags unless `distinctLocaleUrlsReady` is explicitly true.
 */
export function buildLocalizedPublicPathname(locale: SupportedLocale, pathname: string): string {
  const normalized = normalizePathname(pathname);
  if (locale === DEFAULT_LOCALE || normalized === "/") {
    return locale === DEFAULT_LOCALE ? normalized : `/${locale}`;
  }
  return `/${locale}${normalized}`;
}

export function createPublicLocaleRoutingPlan(
  pathname: string,
  input: PublicLocaleRoutingPlanInput = {}
): PublicLocaleRoutingPlan {
  const normalized = normalizePathname(pathname);
  const canonicalLocale = input.canonicalLocale ?? DEFAULT_LOCALE;
  const distinctLocaleUrlsReady = input.distinctLocaleUrlsReady ?? false;
  const localized = input.localized ?? isLocalizedPublicPathname(normalized);
  const strategy = input.strategy ?? (distinctLocaleUrlsReady ? "prefix_except_default" : "unprefixed_single_url");

  const localePathnames =
    localized && distinctLocaleUrlsReady
      ? Object.fromEntries(
          SUPPORTED_LOCALES.map((locale) => [locale, buildLocalizedPublicPathname(locale, normalized)])
        )
      : undefined;

  return {
    pathname: normalized,
    localized,
    canonicalLocale,
    canonicalPathname: normalized,
    distinctLocaleUrlsReady,
    strategy,
    localePathnames,
  };
}

/**
 * Return `undefined` until locale-distinct URLs truly exist. This prevents fake hreflang output
 * on the current single-URL setup while still centralizing the future mapping.
 */
export function buildPublicLocaleLanguageAlternates(
  plan: Pick<PublicLocaleRoutingPlan, "localized" | "distinctLocaleUrlsReady" | "canonicalPathname" | "localePathnames">
): Record<string, string> | undefined {
  if (!plan.localized || !plan.distinctLocaleUrlsReady || !plan.localePathnames) {
    return undefined;
  }

  const languages: Record<string, string> = {
    "x-default": plan.canonicalPathname,
  };

  for (const locale of SUPPORTED_LOCALES) {
    const pathname = plan.localePathnames[locale];
    if (pathname) languages[locale] = pathname;
  }

  return languages;
}

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`;
}
