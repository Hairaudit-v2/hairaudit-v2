/**
 * Single source of truth for UI locales (code, labels, RTL, rollout flags).
 * Add new locales here; keep bundles in translations/ aligned with enabled codes.
 *
 * RTL: set `rtl: true` and add the locale file; `I18nHtmlLang` applies `dir` from
 * {@link getTextDirection}. Disabled locales still get `ltr` until `enabled: true`.
 */
export const DEFAULT_LOCALE = "en" as const;

export type DefaultLocale = typeof DEFAULT_LOCALE;

export const LOCALE_REGISTRY = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    rtl: false as const,
    enabled: true as const,
  },
  {
    code: "es",
    label: "Spanish",
    nativeLabel: "Español",
    rtl: false as const,
    enabled: true as const,
  },
] as const;

export type LocaleRegistryEntry = (typeof LOCALE_REGISTRY)[number];

type EnabledEntry = Extract<LocaleRegistryEntry, { enabled: true }>;

/** Locale codes that are exposed in UI and persistence (enabled only). */
export type SupportedLocale = EnabledEntry["code"];

const enabledEntries: readonly EnabledEntry[] = LOCALE_REGISTRY.filter(
  (e): e is EnabledEntry => e.enabled
);

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = enabledEntries.map((e) => e.code);

const enabledCodes = new Set<string>(SUPPORTED_LOCALES);

const metaByCode = new Map<string, LocaleRegistryEntry>(
  LOCALE_REGISTRY.map((entry) => [entry.code, entry])
);

export function getDefaultLocale(): DefaultLocale {
  return DEFAULT_LOCALE;
}

/** True when `value` is an enabled locale code in {@link LOCALE_REGISTRY}. */
export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return typeof value === "string" && enabledCodes.has(value);
}

/** Registry row for `code`, or `undefined` when unknown or disabled-only entry mismatch. */
export function getLocaleMeta(code: string | null | undefined): LocaleRegistryEntry | undefined {
  if (!code || !metaByCode.has(code)) return undefined;
  return metaByCode.get(code);
}

/** Text direction for `code`; defaults to LTR when unknown (safe for partial rollout). */
export function getTextDirection(code: string | null | undefined): "ltr" | "rtl" {
  const meta = getLocaleMeta(code);
  if (!meta || !meta.enabled) return "ltr";
  return meta.rtl ? "rtl" : "ltr";
}

/**
 * Normalize arbitrary locale strings to a supported code, otherwise English.
 * Trims whitespace; does not write storage (callers decide persistence).
 */
export function normalizeLocale(value: string | null | undefined): SupportedLocale {
  if (value == null) return DEFAULT_LOCALE;
  const trimmed = String(value).trim();
  if (isSupportedLocale(trimmed)) return trimmed;
  return DEFAULT_LOCALE;
}
