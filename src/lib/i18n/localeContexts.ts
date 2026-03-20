import type { SupportedLocale } from "./constants";
import { DEFAULT_LOCALE, normalizeLocale } from "./constants";
import { REPORT_CONTENT_DEFAULT_LOCALE } from "./report";

/**
 * **UI locale** — navigation, dashboards, marketing, form chrome.
 * Today: `profiles.preferred_language`, LanguageSwitcher, `LOCALE_STORAGE_KEY`.
 */
export type UiLocale = SupportedLocale;

/**
 * **Report / output locale** — language patients see in finalized HTML/PDF audit narratives
 * once a translation layer exists. Independent from {@link UiLocale} (e.g. UI in Spanish,
 * report legally delivered in English, or the reverse).
 */
export type ReportOutputLocale = SupportedLocale;

/**
 * **Source / original locale** — language of submitted evidence or dictated notes when known.
 * `"und"` when not determined (BCP 47-style undetermined).
 */
export const REPORT_SOURCE_LOCALE_UNDETERMINED = "und" as const;

export type SourceContentLocale = SupportedLocale | typeof REPORT_SOURCE_LOCALE_UNDETERMINED;

/** Resolved intents for a session or case (blueprint; not persisted). */
export type LocaleIntent = {
  ui: UiLocale;
  reportOutput: ReportOutputLocale;
  source: SourceContentLocale;
};

export function defaultReportOutputLocale(): ReportOutputLocale {
  return REPORT_CONTENT_DEFAULT_LOCALE;
}

/** Normalize arbitrary strings to {@link UiLocale}; invalid → English. */
export function normalizeUiLocale(value: string | null | undefined): UiLocale {
  return normalizeLocale(value);
}

/**
 * Future: persist `report_output_locale` separately from `preferred_language`.
 * Today callers should treat report output as {@link REPORT_CONTENT_DEFAULT_LOCALE}.
 */
export function resolveReportOutputLocale(_ui: UiLocale, explicitReportLocale?: string | null): ReportOutputLocale {
  if (explicitReportLocale && normalizeLocale(explicitReportLocale) !== DEFAULT_LOCALE) {
    return normalizeLocale(explicitReportLocale);
  }
  return defaultReportOutputLocale();
}

/** Build a snapshot for logging or future persistence (pure, no I/O). */
export function describeLocaleIntent(ui: UiLocale, reportOutput?: ReportOutputLocale, source?: SourceContentLocale): LocaleIntent {
  return {
    ui,
    reportOutput: reportOutput ?? defaultReportOutputLocale(),
    source: source ?? REPORT_SOURCE_LOCALE_UNDETERMINED,
  };
}
