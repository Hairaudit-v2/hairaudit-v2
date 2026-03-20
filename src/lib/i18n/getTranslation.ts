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
  return walkPathSegments(obj, parts);
}

function walkPathSegments(obj: JsonRecord, parts: string[]): unknown {
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as JsonRecord)[p];
  }
  return cur;
}

function getIntakeQuestionRecord(locale: string, questionId: string): Record<string, unknown> | undefined {
  const loc = normalizeLocale(locale) as SupportedLocale;
  const parts = ["dashboard", "patient", "forms", "intakeFields", ...questionId.split(".")];
  const read = (l: SupportedLocale): Record<string, unknown> | undefined => {
    const node = walkPathSegments(BUNDLES[l] as JsonRecord, parts);
    if (node && typeof node === "object" && !Array.isArray(node)) return node as Record<string, unknown>;
    return undefined;
  };
  return read(loc) ?? (loc !== DEFAULT_LOCALE ? read(DEFAULT_LOCALE) : undefined);
}

/** Prompt copy under `dashboard.patient.forms.intakeFields` (bracket-walk; supports nested question ids). */
export function getIntakeFieldPrompt(locale: string, questionId: string): string | undefined {
  const v = getIntakeQuestionRecord(locale, questionId)?.prompt;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function getIntakeFieldHelp(locale: string, questionId: string): string | undefined {
  const v = getIntakeQuestionRecord(locale, questionId)?.help;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function getIntakeFieldPlaceholder(locale: string, questionId: string): string | undefined {
  const v = getIntakeQuestionRecord(locale, questionId)?.placeholder;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Visible label for an option value (object key may contain spaces — do not use dotted `getTranslation` paths).
 */
export function getIntakeFieldOptionLabel(locale: string, questionId: string, optionValue: string): string | undefined {
  const opts = getIntakeQuestionRecord(locale, questionId)?.options;
  if (opts && typeof opts === "object" && !Array.isArray(opts)) {
    const v = (opts as JsonRecord)[optionValue];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  }
  return undefined;
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
