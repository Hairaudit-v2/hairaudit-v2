"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";
import PatientConcernBandBanner from "@/components/patient/PatientConcernBandBanner";
import {
  resolvePatientSafeSummaryDisclosureState,
  type PatientSafeSummaryFallbackReason,
} from "@/lib/reports/patientSafeSummaryDisclosure";
import { getConcernBandDisplay, type PatientConcernBand } from "@/lib/reports/patientConcernBands";
import type {
  PatientSafeReportSummary,
  PatientSafeSummaryObservation,
} from "@/lib/reports/patientSafeSummary";

function concernBadgeClass(band?: PatientSafeSummaryObservation["concernBand"]) {
  switch (band) {
    case "urgent":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "significant":
      return "border-orange-200 bg-orange-50 text-orange-900";
    case "needs_review":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "minor":
      return "border-lime-200 bg-lime-50 text-lime-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function ObservationItem({
  item,
  stageLabel,
}: {
  item: PatientSafeSummaryObservation;
  stageLabel: string;
}) {
  return (
    <li className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
          {stageLabel}
        </span>
        {item.concernBand && item.concernBand !== "none" ? (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${concernBadgeClass(item.concernBand)}`}
          >
            {getConcernBandDisplay(item.concernBand as PatientConcernBand).label}
          </span>
        ) : null}
        {item.isRedFlag ? (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
            Flagged for review
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-slate-800">{item.text}</p>
      {item.impact ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">What this may mean: </span>
          {item.impact}
        </p>
      ) : null}
      {item.recommendedNextStep ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-800">Suggested next step: </span>
          {item.recommendedNextStep}
        </p>
      ) : null}
    </li>
  );
}

export default function PatientSafeSummaryShell({
  statusLabel,
  observations,
  reportSummary,
  translatedNarrativeActive = false,
  requestedLocale = "en",
  fallbackReason,
}: {
  statusLabel: string;
  observations: PatientSafeSummaryObservation[];
  reportSummary?: PatientSafeReportSummary | null;
  translatedNarrativeActive?: boolean;
  requestedLocale?: SupportedLocale;
  fallbackReason?: PatientSafeSummaryFallbackReason;
}) {
  const { t } = useI18n();
  const disclosureState = resolvePatientSafeSummaryDisclosureState({
    requestedLocale,
    translatedNarrativeActive,
    fallbackReason,
  });

  const summary = reportSummary ?? null;
  const displayObservations = summary?.observations ?? observations;
  const whatNext = summary?.whatHappensNext;

  const stageLabel = (stage: PatientSafeSummaryObservation["stage"]) =>
    t(`dashboard.patient.safeSummary.stages.${stage}`);

  const disclosureBadge =
    disclosureState === "translated_pilot_active"
      ? t("dashboard.patient.safeSummary.badges.translatedNarrativePilot")
      : disclosureState === "english_source_translation_unavailable"
        ? t("dashboard.patient.safeSummary.badges.translationAvailability")
        : t("dashboard.patient.safeSummary.badges.englishNarrative");

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {t("dashboard.patient.safeSummary.badges.localizedShell")}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {disclosureBadge}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            {t("dashboard.patient.safeSummary.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {disclosureState === "translated_pilot_active"
              ? t("dashboard.patient.safeSummary.subtitleTranslated")
              : disclosureState === "english_source_translation_unavailable"
                ? t("dashboard.patient.safeSummary.subtitleTranslationUnavailable")
                : t("dashboard.patient.safeSummary.subtitle")}
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
          {t("dashboard.patient.safeSummary.statusLabel")} {statusLabel}
        </span>
      </div>

      {summary ? (
        <div className="mt-5 space-y-4">
          <PatientConcernBandBanner
            band={summary.overallConcernBand}
            label={summary.overallConcernLabel}
            description={summary.overallConcernDescription}
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("dashboard.patient.safeSummary.plainEnglishTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{summary.plainEnglishSummary}</p>
          </div>

          {summary.pathwayFocusAreas && summary.pathwayFocusAreas.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {summary.patientReviewPathway === "pre_surgery"
                  ? t("dashboard.patient.safeSummary.pathwayPreSurgeryLabel")
                  : t("dashboard.patient.safeSummary.pathwayPostSurgeryLabel")}
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {summary.pathwayFocusAreas.map((area) => (
                  <li key={area} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.acceptableHighlights.length > 0 ? (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4">
              <h3 className="text-sm font-semibold text-emerald-950">
                {t("dashboard.patient.safeSummary.acceptableTitle")}
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-emerald-900/90">
                {summary.acceptableHighlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.concernItems.length > 0 ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4">
              <h3 className="text-sm font-semibold text-amber-950">
                {t("dashboard.patient.safeSummary.concernsTitle")}
              </h3>
              <p className="mt-1 text-sm text-amber-900/80">{t("dashboard.patient.safeSummary.concernsHint")}</p>
              <ul className="mt-3 space-y-3">
                {summary.concernItems.map((item, idx) => (
                  <ObservationItem
                    key={`concern-${item.stage}-${idx}`}
                    item={item}
                    stageLabel={stageLabel(item.stage)}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {whatNext ? (
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 p-4">
              <h3 className="text-sm font-semibold text-sky-950">
                {t("dashboard.patient.safeSummary.whatHappensNextTitle")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-sky-900/90">{whatNext.intro}</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-sky-950/90">
                {whatNext.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="mt-3 text-sm leading-relaxed text-sky-900/80">{whatNext.reassurance}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          {t("dashboard.patient.safeSummary.observationsTitle")}
        </summary>
        <p className="mt-2 text-sm text-slate-600">
          {disclosureState === "translated_pilot_active"
            ? t("dashboard.patient.safeSummary.observationsHintTranslated")
            : disclosureState === "english_source_translation_unavailable"
              ? t("dashboard.patient.safeSummary.observationsHintTranslationUnavailable")
              : t("dashboard.patient.safeSummary.observationsHint")}
        </p>

        {displayObservations.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t("dashboard.patient.safeSummary.noObservations")}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {displayObservations.map((item, idx) => (
              <ObservationItem
                key={`${item.stage}-${idx}`}
                item={item}
                stageLabel={stageLabel(item.stage)}
              />
            ))}
          </ul>
        )}
      </details>

      <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
        <p className="text-sm leading-relaxed text-slate-600">
          {summary?.clinicalDisclaimer ??
            (disclosureState === "translated_pilot_active"
              ? t("dashboard.patient.safeSummary.disclaimerTranslated")
              : disclosureState === "english_source_translation_unavailable"
                ? t("dashboard.patient.safeSummary.disclaimerTranslationUnavailable")
                : t("dashboard.patient.safeSummary.disclaimer"))}
        </p>
        <p className="text-sm font-medium text-slate-700">{t("dashboard.patient.safeSummary.actionPrompt")}</p>
        <p className="text-xs leading-relaxed text-slate-500">{t("dashboard.patient.safeSummary.trustLine")}</p>
      </div>
    </section>
  );
}
