"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import { buildAssessmentConfidence } from "@/lib/reports/assessmentConfidence";
import { buildAssessmentImprovementRecommendations } from "@/lib/reports/assessmentImprovementRecommendations";
import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import type { PreSurgeryPlanningReport } from "@/lib/reports/preSurgeryPlanningReport";

export default function AssessmentImprovementRecommendationsSection({
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

  const { confidence, recommendations } = useMemo(() => {
    const baseParams = {
      pathway,
      postReport,
      preReport,
      uploads,
      clinicalHistory,
      imageLimitedAssessment,
      documentAssistedAssessment,
    };
    const confidenceResult = buildAssessmentConfidence(baseParams);
    const recommendationResult = buildAssessmentImprovementRecommendations({
      ...baseParams,
      confidence: confidenceResult,
    });
    return { confidence: confidenceResult, recommendations: recommendationResult };
  }, [
    pathway,
    postReport,
    preReport,
    uploads,
    clinicalHistory,
    imageLimitedAssessment,
    documentAssistedAssessment,
  ]);

  if (confidence.band === "high") {
    return (
      <div
        data-testid="assessment-improvement-section"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h3 className="text-lg font-semibold text-slate-900">
          {t("dashboard.patient.report.assessmentImprovement.title")}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          {t("dashboard.patient.report.assessmentImprovement.highCoverageMessage")}
        </p>
      </div>
    );
  }

  if (recommendations.itemIds.length === 0) return null;

  return (
    <div
      data-testid="assessment-improvement-section"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-semibold text-slate-900">
        {t("dashboard.patient.report.assessmentImprovement.title")}
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        {t("dashboard.patient.report.assessmentImprovement.subtitle")}
      </p>

      <ul className="mt-4 space-y-2">
        {recommendations.itemIds.map((id) => (
          <li
            key={id}
            className="flex items-start gap-2 text-sm leading-relaxed text-slate-800"
          >
            <span className="mt-0.5 shrink-0 font-bold text-sky-700" aria-hidden>
              •
            </span>
            <span>
              {t(
                `dashboard.patient.report.assessmentImprovement.items.${id}` as TranslationKey
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-600">
        {t("dashboard.patient.report.assessmentImprovement.footer")}
      </p>
    </div>
  );
}
