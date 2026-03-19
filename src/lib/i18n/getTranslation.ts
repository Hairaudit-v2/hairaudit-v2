import type { SupportedLocale } from "./constants";
import { DEFAULT_LOCALE, normalizeLocale } from "./constants";
import type { TranslationKey } from "./translationKeys";
import en from "./translations/en.json";
import es from "./translations/es.json";

type JsonRecord = Record<string, unknown>;

const BUNDLES: Record<SupportedLocale, JsonRecord> = {
  en: en as JsonRecord,
  es: es as JsonRecord,
};

function getByPath(obj: JsonRecord, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as JsonRecord)[p];
  }
  return cur;
}

function warnDev(message: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.warn(`[HairAudit i18n] ${message}`, payload);
}

export type TranslateFn = {
  /** Prefer dotted keys from `TranslationKey` for typo safety. */
  (key: TranslationKey): string;
  /** Escape hatch for dynamic or yet-untyped keys. */
  (key: string): string;
};

/**
 * Resolve a dotted translation key for a locale, falling back to English when missing.
 * In development, logs when falling back or when the key is absent everywhere.
 */
export function getTranslation(key: TranslationKey, locale: string): string;
export function getTranslation(key: string, locale: string): string;
export function getTranslation(key: string, locale: string): string {
  const loc = normalizeLocale(locale);
  const primary = getByPath(BUNDLES[loc], key);
  if (typeof primary === "string" && primary.length > 0) {
    return primary;
  }

  if (loc !== DEFAULT_LOCALE) {
    const fallback = getByPath(BUNDLES[DEFAULT_LOCALE], key);
    if (typeof fallback === "string" && fallback.length > 0) {
      warnDev("Missing translation; fell back to English.", { key, locale: loc });
      return fallback;
    }
  }

  warnDev("Missing translation in requested and default locale.", { key, locale: loc });
  return key;
}
