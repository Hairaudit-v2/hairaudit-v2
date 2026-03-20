import type { SupportedLocale } from "./constants";
import { REPORT_SOURCE_LOCALE_UNDETERMINED, type SourceContentLocale } from "./localeContexts";

/**
 * Lifecycle of a translated report artifact (blueprint only — **not** written by current generators).
 */
export type ReportTranslationStatus =
  | "none"
  | "pending"
  | "machine"
  | "human_reviewed"
  | "validated";

/** Coarse sections that could be translated independently in a future pipeline. */
export type ReportTranslatedSectionId =
  | "executiveSummary"
  | "findings"
  | "recommendations"
  | "domainScores"
  | "metadata";

/**
 * Per-section bookkeeping for review / provenance (additive future schema).
 * Empty objects are valid; generators today must ignore this type entirely.
 */
export type ReportTranslationSectionBlueprint = {
  id: ReportTranslatedSectionId;
  reviewed: boolean;
  reviewedAt?: string;
  translationProvenance?: string;
};

/**
 * Container for a future stored translation bundle (e.g. JSON column or sidecar document).
 * **Do not** attach to live `finalize` / PDF paths until schemas and product sign-off exist.
 */
export type ReportTranslationPlan = {
  sourceLocale: SourceContentLocale;
  targetLocale: SupportedLocale;
  sections: Partial<Record<ReportTranslatedSectionId, ReportTranslationSectionBlueprint>>;
  status: ReportTranslationStatus;
};

export function createEmptyReportTranslationPlan(targetLocale: SupportedLocale): ReportTranslationPlan {
  return {
    sourceLocale: REPORT_SOURCE_LOCALE_UNDETERMINED,
    targetLocale,
    sections: {},
    status: "none",
  };
}
