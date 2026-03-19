/** localStorage key for guest + client-side locale cache */
export const LOCALE_STORAGE_KEY = "hairaudit.preferred_language";

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
