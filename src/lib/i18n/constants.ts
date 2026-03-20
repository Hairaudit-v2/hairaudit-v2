/** localStorage key for guest + client-side locale cache */
export const LOCALE_STORAGE_KEY = "hairaudit.preferred_language";

/**
 * Cookie name mirrors {@link LOCALE_STORAGE_KEY} so `generateMetadata` can resolve the same
 * preference the client persists (see `syncSeoLocaleCookie`).
 */
export const SEO_LOCALE_COOKIE_NAME = LOCALE_STORAGE_KEY;

export {
  DEFAULT_LOCALE,
  LOCALE_REGISTRY,
  SUPPORTED_LOCALES,
  type DefaultLocale,
  type LocaleRegistryEntry,
  type SupportedLocale,
  getDefaultLocale,
  getLocaleMeta,
  getTextDirection,
  isSupportedLocale,
  normalizeLocale,
} from "./locales";
