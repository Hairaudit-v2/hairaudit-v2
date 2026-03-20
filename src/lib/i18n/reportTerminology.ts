import type { SupportedLocale } from "./constants";
import { getTranslation } from "./getTranslation";
import type { TranslationKey } from "./translationKeys";

/**
 * Stable slugs for controlled **glossary** labels (rubrics, legends, future report chrome).
 * Not used by PDF or AI report generation in this phase.
 */
export const REPORT_GLOSSARY_SLUGS = [
  "donorManagement",
  "graftHandling",
  "implantationTechnique",
  "density",
  "transection",
  "documentationQuality",
] as const;

export type ReportGlossarySlug = (typeof REPORT_GLOSSARY_SLUGS)[number];

const SLUG_TO_KEY = {
  donorManagement: "reportGlossary.donorManagement",
  graftHandling: "reportGlossary.graftHandling",
  implantationTechnique: "reportGlossary.implantationTechnique",
  density: "reportGlossary.density",
  transection: "reportGlossary.transection",
  documentationQuality: "reportGlossary.documentationQuality",
} as const satisfies Record<ReportGlossarySlug, TranslationKey>;

export function reportGlossaryTranslationKey(slug: ReportGlossarySlug): TranslationKey {
  return SLUG_TO_KEY[slug];
}

/** Resolve a glossary label via i18n bundles (English fallback via `getTranslation`). */
export function getReportGlossaryLabel(slug: ReportGlossarySlug, locale: SupportedLocale): string {
  return getTranslation(SLUG_TO_KEY[slug], locale);
}
