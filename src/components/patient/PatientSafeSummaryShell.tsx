"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";
import PatientConcernBandBanner from "@/components/patient/PatientConcernBandBanner";
import {
  resolvePatientSafeSummaryDisclosureState,
  type PatientSafeSummaryFallbackReason,
} from "@/lib/reports/patientSafeSummaryDisclosure";
import type {
  PatientSafeReportSummary,
  PatientSafeSummaryObservation,
} from "@/lib/reports/patientSafeSummary";

function scoreChip(score?: number | null) {
  if (typeof score !== "number") return "border-slate-300/25 bg-slate-300/10 text-slate-100";
  if (score >= 85) return "border-emerald-300/40 bg-emerald-300/20 text-emerald-100";
  if (score >= 70) return "border-lime-300/40 bg-lime-300/20 text-lime-100";
  if (score >= 55) return "border-amber-300/40 bg-amber-300/20 text-amber-100";
  return "border-rose-300/40 bg-rose-300/20 text-rose-100";
}

function concernBadgeClass(band?: PatientSafeSummaryObservation["concernBand"]) {
  switch (band) {
    case "urgent":
      return "border-rose-300/40 bg-rose-300/15 text-rose-100";
    case "significant":
      return "border-orange-300/35 bg-orange-300/10 text-orange-100";
    case "needs_review":
      return "border-amber-300/35 bg-amber-300/10 text-amber-100";
    case "minor":
      return "border-lime-300/30 bg-lime-300/10 text-lime-100";
    default:
      return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
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
    <li className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
          {stageLabel}
        </span>
        {item.concernBand && item.concernBand !== "none" ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${concernBadgeClass(item.concernBand)}`}
          >
            {item.concernBand.replace(/_/g, " ")}
          </span>
        ) : null}
        {item.isRedFlag ? (
          <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-2 py-0.5 text-[11px] font-semibold text-rose-100">
            Flagged for review
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-slate-100">{item.text}</p>
      {item.impact ? (
        <p className="mt-2 text-xs text-slate-300">
          <span className="font-semibold text-slate-200">Why it matters: </span>
          {item.impact}
        </p>
      ) : null}
      {item.recommendedNextStep ? (
        <p className="mt-1 text-xs text-cyan-100/90">
          <span className="font-semibold">Suggested next step: </span>
          {item.recommendedNextStep}
        </p>
      ) : null}
    </li>
  );
}

export default function PatientSafeSummaryShell({
  statusLabel,
  score,
  observations,
  reportSummary,
  translatedNarrativeActive = false,
  requestedLocale = "en",
  fallbackReason,
}: {
  statusLabel: string;
  score?: number | null;
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

  const stageLabel = (stage: PatientSafeSummaryObservation["stage"]) =>
    t(`dashboard.patient.safeSummary.stages.${stage}`);

  return (
    <section className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
              {t("dashboard.patient.safeSummary.badges.localizedShell")}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
              {disclosureState === "translated_pilot_active"
                ? t("dashboard.patient.safeSummary.badges.translatedNarrativePilot")
                : disclosureState === "english_source_translation_unavailable"
                  ? t("dashboard.patient.safeSummary.badges.translationAvailability")
                  : t("dashboard.patient.safeSummary.badges.englishNarrative")}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">{t("dashboard.patient.safeSummary.title")}</h2>
          <p className="mt-1 text-sm text-slate-200/80">
            {disclosureState === "translated_pilot_active"
              ? t("dashboard.patient.safeSummary.subtitleTranslated")
              : disclosureState === "english_source_translation_unavailable"
                ? t("dashboard.patient.safeSummary.subtitleTranslationUnavailable")
                : t("dashboard.patient.safeSummary.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100">
            {t("dashboard.patient.safeSummary.statusLabel")} {statusLabel}
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${scoreChip(score)}`}>
            {t("dashboard.patient.safeSummary.scoreLabel")} {typeof score === "number" ? score : t("reports.status.pending")}
          </span>
        </div>
      </div>

      {summary ? (
        <div className="mt-4 space-y-4">
          <PatientConcernBandBanner
            band={summary.overallConcernBand}
            label={summary.overallConcernLabel}
            description={summary.overallConcernDescription}
          />

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-white">
              {t("dashboard.patient.safeSummary.plainEnglishTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-100">{summary.plainEnglishSummary}</p>
          </div>

          {summary.concernItems.length > 0 ? (
            <div className="rounded-xl border border-rose-300/20 bg-rose-300/5 p-4">
              <h3 className="text-sm font-semibold text-rose-100">
                {t("dashboard.patient.safeSummary.concernsTitle")}
              </h3>
              <p className="mt-1 text-xs text-rose-100/80">{t("dashboard.patient.safeSummary.concernsHint")}</p>
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

          {summary.acceptableHighlights.length > 0 ? (
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4">
              <h3 className="text-sm font-semibold text-emerald-100">
                {t("dashboard.patient.safeSummary.acceptableTitle")}
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-50/90">
                {summary.acceptableHighlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white">{t("dashboard.patient.safeSummary.observationsTitle")}</h3>
        <p className="mt-1 text-xs text-slate-300/80">
          {disclosureState === "translated_pilot_active"
            ? t("dashboard.patient.safeSummary.observationsHintTranslated")
            : disclosureState === "english_source_translation_unavailable"
              ? t("dashboard.patient.safeSummary.observationsHintTranslationUnavailable")
              : t("dashboard.patient.safeSummary.observationsHint")}
        </p>

        {displayObservations.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300/80">{t("dashboard.patient.safeSummary.noObservations")}</p>
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
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-slate-300/80">
          {summary?.clinicalDisclaimer ??
            (disclosureState === "translated_pilot_active"
              ? t("dashboard.patient.safeSummary.disclaimerTranslated")
              : disclosureState === "english_source_translation_unavailable"
                ? t("dashboard.patient.safeSummary.disclaimerTranslationUnavailable")
                : t("dashboard.patient.safeSummary.disclaimer"))}
        </p>
        <p className="text-xs font-medium text-cyan-100">{t("dashboard.patient.safeSummary.actionPrompt")}</p>
      </div>
    </section>
  );
}
