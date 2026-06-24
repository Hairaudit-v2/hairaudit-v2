import type { SupportedLocale } from "@/lib/i18n/constants";
import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/i18n/constants";

/**
 * Long-Term Hair Restoration Guide (Hair Longevity Institute) — patient reward PDF.
 * Served dynamically via rewrite to `/api/reports/patient-long-term-guide`.
 */
export const POST_OPERATIVE_HAIR_PROTECTION_GUIDE_PUBLIC_PATH =
  "/post-operative-hair-protection-guide.pdf" as const;

export const PATIENT_LONG_TERM_GUIDE_PRINT_PATH = "/api/print/patient-long-term-guide" as const;

/** PDF download href with locale query when not English (preserves legacy path + rewrite). */
export function buildPatientLongTermGuidePdfHref(localeInput?: string): string {
  const locale = normalizeLocale(localeInput) as SupportedLocale;
  if (locale === DEFAULT_LOCALE) {
    return POST_OPERATIVE_HAIR_PROTECTION_GUIDE_PUBLIC_PATH;
  }
  return `${POST_OPERATIVE_HAIR_PROTECTION_GUIDE_PUBLIC_PATH}?locale=${encodeURIComponent(locale)}`;
}
