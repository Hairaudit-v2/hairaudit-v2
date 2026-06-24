"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type {
  PostSurgeryAuditReport,
  PostSurgeryConcernSeverity,
  PostSurgeryReviewSectionId,
  PostSurgeryScorecardMetricId,
} from "@/lib/reports/postSurgeryAuditReport";
import {
  resolvePatientSafeSummaryDisclosureState,
  type PatientSafeSummaryFallbackReason,
} from "@/lib/reports/patientSafeSummaryDisclosure";
import ClinicalEvidenceReviewGallery from "@/components/reports/ClinicalEvidenceReviewGallery";
import LongTermHairPreservationSection from "@/components/patient/LongTermHairPreservationSection";
import ReviewInputsProcessedSection from "@/components/patient/ReviewInputsProcessedSection";
import AssessmentConfidenceSection from "@/components/patient/AssessmentConfidenceSection";
import AssessmentImprovementRecommendationsSection from "@/components/patient/AssessmentImprovementRecommendationsSection";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";

const SECTION_ORDER: PostSurgeryReviewSectionId[] = [
  "overall_procedure",
  "donor_area",
  "extraction_pattern",
  "density_distribution",
  "recipient_area",
  "procedural_integrity",
  "long_term_risk",
  "repair_considerations",
];

const SCORECARD_ORDER: PostSurgeryScorecardMetricId[] = [
  "donor_preservation",
  "extraction_pattern",
  "density_distribution",
  "recipient_area",
  "healing_quality",
  "repair_probability",
];

function concernSeverityClass(severity: PostSurgeryConcernSeverity) {
  switch (severity) {
    case "significant":
      return "border-orange-200 bg-orange-50 text-orange-950";
    case "elevated":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "moderate":
      return "border-yellow-200 bg-yellow-50 text-yellow-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

function outcomeHeroClass(outcomeId: PostSurgeryAuditReport["proceduralOutcomeId"]) {
  switch (outcomeId) {
    case "strong_outcome":
      return "border-emerald-300/40 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-emerald-50";
    case "moderate_concerns":
      return "border-amber-300/40 bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-950 text-amber-50";
    case "donor_preservation_concerns":
      return "border-orange-300/40 bg-gradient-to-br from-orange-950/80 via-slate-900 to-slate-950 text-orange-50";
    default:
      return "border-slate-300/40 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100";
  }
}

export default function PostSurgeryAuditReportShell({
  report,
  statusLabel,
  translatedNarrativeActive = false,
  requestedLocale = "en",
  fallbackReason,
  uploads = [],
  caseId,
  clinicalHistory,
  imageLimitedAssessment,
  documentAssistedAssessment,
}: {
  report: PostSurgeryAuditReport;
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
  clinicalHistory?: ClinicalHistorySnapshot | null;
  imageLimitedAssessment?: boolean;
  documentAssistedAssessment?: boolean;
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
    `dashboard.patient.postSurgeryReport.outcomes.${report.proceduralOutcomeId}` as TranslationKey;
  const repairKey =
    `dashboard.patient.postSurgeryReport.repairStates.${report.repairConsiderationId}` as TranslationKey;

  return (
    <section data-testid="post-surgery-report-shell" className="mt-6 space-y-5">
      <div
        className={`overflow-hidden rounded-2xl border p-6 shadow-lg sm:p-8 ${outcomeHeroClass(
          report.proceduralOutcomeId
        )}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                {t("dashboard.patient.postSurgeryReport.badges.complete")}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                {disclosureBadge}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("dashboard.patient.postSurgeryReport.hero.title")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
              {t("dashboard.patient.postSurgeryReport.hero.subtitle")}
            </p>
          </div>
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold">
            {t("dashboard.patient.safeSummary.statusLabel")} {statusLabel}
          </span>
        </div>

        <div className="mt-6 rounded-xl border border-white/20 bg-black/25 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
            {t("dashboard.patient.postSurgeryReport.hero.outcomeLabel")}
          </p>
          <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{t(outcomeKey)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900">
          {t("dashboard.patient.postSurgeryReport.scorecards.title")}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {t("dashboard.patient.postSurgeryReport.scorecards.subtitle")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCORECARD_ORDER.map((id) => {
            const card = scorecardById.get(id);
            if (!card) return null;
            const labelKey =
              `dashboard.patient.postSurgeryReport.scorecards.metrics.${id}` as TranslationKey;
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

      <ReviewInputsProcessedSection pathway="post_surgery" postReport={report} uploads={uploads} />

      <AssessmentConfidenceSection
        pathway="post_surgery"
        postReport={report}
        uploads={uploads}
        clinicalHistory={clinicalHistory}
        imageLimitedAssessment={imageLimitedAssessment}
        documentAssistedAssessment={documentAssistedAssessment}
      />

      <AssessmentImprovementRecommendationsSection
        pathway="post_surgery"
        postReport={report}
        uploads={uploads}
        clinicalHistory={clinicalHistory}
        imageLimitedAssessment={imageLimitedAssessment}
        documentAssistedAssessment={documentAssistedAssessment}
      />

      {report.concernFlags.length > 0 ? (
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/60 p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-semibold text-amber-950">
            {t("dashboard.patient.postSurgeryReport.concerns.title")}
          </h3>
          <p className="mt-1 text-sm text-amber-900/80">
            {t("dashboard.patient.postSurgeryReport.concerns.subtitle")}
          </p>
          <ul className="mt-4 space-y-3">
            {report.concernFlags.map((flag, idx) => (
              <li
                key={`concern-${idx}`}
                className="rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${concernSeverityClass(
                      flag.severity
                    )}`}
                  >
                    {t(
                      `dashboard.patient.postSurgeryReport.concerns.severity.${flag.severity}` as TranslationKey
                    )}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-800">{flag.text}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900">
          {t("dashboard.patient.postSurgeryReport.sections.title")}
        </h3>
        <div className="mt-4 space-y-4">
          {SECTION_ORDER.map((id, index) => {
            const section = sectionById.get(id);
            if (!section) return null;
            const titleKey =
              `dashboard.patient.postSurgeryReport.sections.${id}` as TranslationKey;
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
          titleKey="dashboard.patient.postSurgeryReport.images.title"
          subtitleKey="dashboard.patient.postSurgeryReport.images.subtitle"
          noPhotoKey="dashboard.patient.postSurgeryReport.images.noPhoto"
        />
      ) : null}

      <LongTermHairPreservationSection pathway="post_surgery" />

      <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-sky-950">
          {t("dashboard.patient.postSurgeryReport.trust.title")}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-sky-900/90">
          {t("dashboard.patient.postSurgeryReport.trust.body")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-sky-900/80">
          {t("dashboard.patient.postSurgeryReport.trust.neutrality")}
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-emerald-950">
          {t("dashboard.patient.postSurgeryReport.nextSteps.title")}
        </h3>
        <p className="mt-1 text-sm text-emerald-900/80">
          {t("dashboard.patient.postSurgeryReport.nextSteps.subtitle")}
        </p>
        <ul className="mt-4 space-y-2">
          {report.recommendedNextSteps.map((step) => (
            <li key={step} className="flex gap-2 text-sm leading-relaxed text-emerald-950/90">
              <span className="font-bold text-emerald-700" aria-hidden>✓</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-emerald-900/75">
          {t("dashboard.patient.postSurgeryReport.repairLabel")}: {t(repairKey)}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600">
        <p>{report.patientSafeSummary.clinicalDisclaimer}</p>
        <p className="mt-3 text-xs text-slate-500">
          {t("dashboard.patient.postSurgeryReport.meta.reportId")}: {report.reportId}
        </p>
      </div>
    </section>
  );
}
