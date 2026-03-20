import type { SupportedLocale } from "@/lib/i18n/constants";

export type PatientSafeSummaryFallbackReason =
  | "pilot_disabled"
  | "unsupported_locale"
  | "missing_db"
  | "missing_report_context"
  | "no_source_observations"
  | "no_stored_translation"
  | "stored_translation_not_servable"
  | "generation_failed";

export type PatientSafeSummaryDisclosureState =
  | "translated_pilot_active"
  | "english_source_default"
  | "english_source_translation_unavailable";

export function resolvePatientSafeSummaryDisclosureState(args: {
  requestedLocale: SupportedLocale;
  translatedNarrativeActive: boolean;
  fallbackReason?: PatientSafeSummaryFallbackReason;
}): PatientSafeSummaryDisclosureState {
  if (args.translatedNarrativeActive) return "translated_pilot_active";
  if (args.requestedLocale !== "es") return "english_source_default";
  return "english_source_translation_unavailable";
}
