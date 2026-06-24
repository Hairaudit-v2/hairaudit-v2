"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import {
  buildAssessmentConfidence,
  type AssessmentConfidenceBand,
} from "@/lib/reports/assessmentConfidence";
import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import type { PreSurgeryPlanningReport } from "@/lib/reports/preSurgeryPlanningReport";

function bandBadgeClass(band: AssessmentConfidenceBand): string {
  switch (band) {
    case "high":
      return "border-sky-200 bg-sky-50 text-sky-950";
    case "moderate":
      return "border-amber-200 bg-amber-50 text-amber-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

export default function AssessmentConfidenceSection({
  pathway,
  postReport,
  preReport,
  uploads = [],
  clinicalHistory,
  imageLimitedAssessment,
  documentAssistedAssessment,
}: {
  pathway: PatientReviewPathway;
  postReport?: PostSurgeryAuditReport | null;
  preReport?: PreSurgeryPlanningReport | null;
  uploads?: Array<{
    id: string;
    type: string;
    storage_path: string;
    metadata?: Record<string, unknown> | null;
  }>;
  clinicalHistory?: ClinicalHistorySnapshot | null;
  imageLimitedAssessment?: boolean;
  documentAssistedAssessment?: boolean;
}) {
  const { t } = useI18n();

  const result = useMemo(
    () =>
      buildAssessmentConfidence({
        pathway,
        postReport,
        preReport,
        uploads,
        clinicalHistory,
        imageLimitedAssessment,
        documentAssistedAssessment,
      }),
    [
      pathway,
      postReport,
      preReport,
      uploads,
      clinicalHistory,
      imageLimitedAssessment,
      documentAssistedAssessment,
    ]
  );

  const bandKey =
    `dashboard.patient.report.assessmentConfidence.band.${result.band}` as TranslationKey;
  const summaryKey =
    `dashboard.patient.report.assessmentConfidence.summary.${result.band}.${pathway}` as TranslationKey;

  return (
    <div
      data-testid="assessment-confidence-section"
      className="rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/80 to-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("dashboard.patient.report.assessmentConfidence.title")}
          </h3>
          <span
            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${bandBadgeClass(result.band)}`}
          >
            {t(bandKey)}
          </span>
        </div>
        <p className="text-3xl font-bold tracking-tight text-sky-700">{result.score}%</p>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700">{t(summaryKey)}</p>

      {(result.strengths.length > 0 || result.limitations.length > 0) && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {result.strengths.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("dashboard.patient.report.assessmentConfidence.strengthsTitle")}
              </p>
              <ul className="mt-2 space-y-2">
                {result.strengths.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-slate-800">
                    <span className="mt-0.5 shrink-0 font-bold text-sky-700" aria-hidden>
                      +
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.limitations.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("dashboard.patient.report.assessmentConfidence.limitationsTitle")}
              </p>
              <ul className="mt-2 space-y-2">
                {result.limitations.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-slate-800">
                    <span className="mt-0.5 shrink-0 font-bold text-amber-700" aria-hidden>
                      –
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-600">
        {t("dashboard.patient.report.assessmentConfidence.helper")}
      </p>
    </div>
  );
}
