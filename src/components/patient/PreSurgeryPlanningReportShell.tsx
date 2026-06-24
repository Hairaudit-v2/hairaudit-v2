"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type {
  PreSurgeryPlanningReport,
  PreSurgeryReviewSectionId,
  PreSurgeryScorecardMetricId,
} from "@/lib/reports/preSurgeryPlanningReport";
import {
  resolvePatientSafeSummaryDisclosureState,
  type PatientSafeSummaryFallbackReason,
} from "@/lib/reports/patientSafeSummaryDisclosure";
import ClinicalEvidenceReviewGallery from "@/components/reports/ClinicalEvidenceReviewGallery";
import LongTermHairPreservationSection from "@/components/patient/LongTermHairPreservationSection";

const SECTION_ORDER: PreSurgeryReviewSectionId[] = [
  "overall_planning",
  "hair_loss_pattern",
  "donor_area",
  "estimated_graft_requirement",
  "surgical_suitability",
  "future_progression",
  "medical_treatment",
];

const SCORECARD_ORDER: PreSurgeryScorecardMetricId[] = [
  "hair_loss_progression_risk",
  "donor_area_strength",
  "restoration_suitability",
  "estimated_graft_requirement",
  "long_term_preservation_score",
  "treatment_stabilisation_priority",
];

function outcomeHeroClass(outcomeId: PreSurgeryPlanningReport["planningOutcomeId"]) {
  switch (outcomeId) {
    case "strong_surgical_candidate":
      return "border-emerald-300/40 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-emerald-50";
    case "suitable_with_long_term_planning":
      return "border-sky-300/40 bg-gradient-to-br from-sky-950/80 via-slate-900 to-slate-950 text-sky-50";
    case "medical_stabilisation_recommended_first":
      return "border-violet-300/40 bg-gradient-to-br from-violet-950/80 via-slate-900 to-slate-950 text-violet-50";
    case "donor_limitations_identified":
      return "border-orange-300/40 bg-gradient-to-br from-orange-950/80 via-slate-900 to-slate-950 text-orange-50";
    default:
      return "border-slate-300/40 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100";
  }
}

export default function PreSurgeryPlanningReportShell({
  report,
  statusLabel,
  translatedNarrativeActive = false,
  requestedLocale = "en",
  fallbackReason,
  uploads = [],
  caseId,
}: {
  report: PreSurgeryPlanningReport;
  statusLabel: string;
  translatedNarrativeActive?: boolean;
  requestedLocale?: SupportedLocale;
  fallbackReason?: PatientSafeSummaryFallbackReason;
  uploads?: Array<{
    id: string;
    type: string;
    storage_path: string;
    metadata?: Record<string, unknown> | null;
  }>;
  caseId?: string;
}) {
  const { t } = useI18n();
  const disclosureState = resolvePatientSafeSummaryDisclosureState({
    requestedLocale,
    translatedNarrativeActive,
    fallbackReason,
  });

  const sectionById = new Map(report.sections.map((s) => [s.id, s]));
  const scorecardById = new Map(report.scorecards.map((s) => [s.id, s]));

  const disclosureBadge =
    disclosureState === "translated_pilot_active"
      ? t("dashboard.patient.safeSummary.badges.translatedNarrativePilot")
      : disclosureState === "english_source_translation_unavailable"
        ? t("dashboard.patient.safeSummary.badges.translationAvailability")
        : t("dashboard.patient.safeSummary.badges.englishNarrative");

  const outcomeKey =
    `dashboard.patient.preSurgeryReport.outcomes.${report.planningOutcomeId}` as TranslationKey;

  return (
    <section data-testid="pre-surgery-report-shell" className="mt-6 space-y-5">
      <div
        className={`overflow-hidden rounded-2xl border p-6 shadow-lg sm:p-8 ${outcomeHeroClass(
          report.planningOutcomeId
        )}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                {t("dashboard.patient.preSurgeryReport.badges.complete")}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                {disclosureBadge}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("dashboard.patient.preSurgeryReport.hero.title")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
              {t("dashboard.patient.preSurgeryReport.hero.subtitle")}
            </p>
          </div>
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold">
            {t("dashboard.patient.safeSummary.statusLabel")} {statusLabel}
          </span>
        </div>

        <div className="mt-6 rounded-xl border border-white/20 bg-black/25 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
            {t("dashboard.patient.preSurgeryReport.hero.outcomeLabel")}
          </p>
          <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{t(outcomeKey)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900">
          {t("dashboard.patient.preSurgeryReport.scorecards.title")}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {t("dashboard.patient.preSurgeryReport.scorecards.subtitle")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCORECARD_ORDER.map((id) => {
            const card = scorecardById.get(id);
            if (!card) return null;
            const labelKey =
              `dashboard.patient.preSurgeryReport.scorecards.metrics.${id}` as TranslationKey;
            return (
              <div
                key={id}
                className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t(labelKey)}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                  {card.displayValue}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900">
          {t("dashboard.patient.preSurgeryReport.sections.title")}
        </h3>
        <div className="mt-4 space-y-4">
          {SECTION_ORDER.map((id, index) => {
            const section = sectionById.get(id);
            if (!section) return null;
            const titleKey =
              `dashboard.patient.preSurgeryReport.sections.${id}` as TranslationKey;
            return (
              <article
                key={id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-slate-900">{t(titleKey)}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{section.finding}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {caseId ? (
        <ClinicalEvidenceReviewGallery
          uploads={uploads}
          caseId={caseId}
          titleKey="dashboard.patient.preSurgeryReport.images.title"
          subtitleKey="dashboard.patient.preSurgeryReport.images.subtitle"
          noPhotoKey="dashboard.patient.preSurgeryReport.images.noPhoto"
        />
      ) : null}

      <LongTermHairPreservationSection pathway="pre_surgery" />

      <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-sky-950">
          {t("dashboard.patient.preSurgeryReport.trust.title")}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-sky-900/90">
          {t("dashboard.patient.preSurgeryReport.trust.body")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-sky-900/80">
          {t("dashboard.patient.preSurgeryReport.trust.neutrality")}
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-emerald-950">
          {t("dashboard.patient.preSurgeryReport.nextSteps.title")}
        </h3>
        <p className="mt-1 text-sm text-emerald-900/80">
          {t("dashboard.patient.preSurgeryReport.nextSteps.subtitle")}
        </p>
        <ul className="mt-4 space-y-2">
          {report.recommendedNextSteps.map((step) => (
            <li key={step} className="flex gap-2 text-sm leading-relaxed text-emerald-950/90">
              <span className="font-bold text-emerald-700" aria-hidden>✓</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600">
        <p>{report.patientSafeSummary.clinicalDisclaimer}</p>
        <p className="mt-3 text-xs text-slate-500">
          {t("dashboard.patient.preSurgeryReport.meta.reportId")}: {report.reportId}
        </p>
      </div>
    </section>
  );
}
