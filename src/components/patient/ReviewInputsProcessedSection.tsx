"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import type { PreSurgeryPlanningReport } from "@/lib/reports/preSurgeryPlanningReport";
import {
  buildReviewInputsProcessed,
  type ReviewInputChecklistItem,
  type ReviewInputId,
} from "@/lib/reports/reviewInputsProcessed";

const ITEM_LABEL_KEYS: Record<ReviewInputId, TranslationKey> = {
  clinical_images: "dashboard.patient.report.reviewInputs.items.clinical_images",
  procedure_data: "dashboard.patient.report.reviewInputs.items.procedure_data",
  clinical_notes: "dashboard.patient.report.reviewInputs.items.clinical_notes",
  support_documentation: "dashboard.patient.report.reviewInputs.items.support_documentation",
  graft_count_data: "dashboard.patient.report.reviewInputs.items.graft_count_data",
  donor_analysis: "dashboard.patient.report.reviewInputs.items.donor_analysis",
  recipient_assessment: "dashboard.patient.report.reviewInputs.items.recipient_assessment",
  hairline_design: "dashboard.patient.report.reviewInputs.items.hairline_design",
  extraction_pattern: "dashboard.patient.report.reviewInputs.items.extraction_pattern",
  density_review: "dashboard.patient.report.reviewInputs.items.density_review",
  healing_patterns: "dashboard.patient.report.reviewInputs.items.healing_patterns",
  repair_probability: "dashboard.patient.report.reviewInputs.items.repair_probability",
  procedural_consistency: "dashboard.patient.report.reviewInputs.items.procedural_consistency",
  future_risk: "dashboard.patient.report.reviewInputs.items.future_risk",
  sustainability: "dashboard.patient.report.reviewInputs.items.sustainability",
  hair_loss_pattern: "dashboard.patient.report.reviewInputs.items.hair_loss_pattern",
  donor_reserve: "dashboard.patient.report.reviewInputs.items.donor_reserve",
  surgical_candidacy: "dashboard.patient.report.reviewInputs.items.surgical_candidacy",
  future_planning: "dashboard.patient.report.reviewInputs.items.future_planning",
  medical_treatment_context: "dashboard.patient.report.reviewInputs.items.medical_treatment_context",
};

function resolveItemDisplayLabel(
  item: ReviewInputChecklistItem,
  t: (key: TranslationKey) => string
): string {
  const template = t(ITEM_LABEL_KEYS[item.id]);
  if (item.id === "clinical_images" && item.imageCount != null) {
    return template.replace("{{count}}", String(item.imageCount));
  }
  return template;
}

export default function ReviewInputsProcessedSection({
  pathway,
  postReport,
  preReport,
  uploads = [],
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
}) {
  const { t } = useI18n();

  const content = useMemo(
    () =>
      buildReviewInputsProcessed({
        pathway,
        postReport,
        preReport,
        uploads,
      }),
    [pathway, postReport, preReport, uploads]
  );

  if (content.items.length === 0) return null;

  const displayLabels = content.items.map((item) => resolveItemDisplayLabel(item, t));

  return (
    <div
      data-testid="review-inputs-processed-section"
      className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-semibold text-slate-900">
        {t("dashboard.patient.report.reviewInputs.title")}
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        {t("dashboard.patient.report.reviewInputs.subtitle")}
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {displayLabels.map((label) => (
          <li key={label} className="flex items-start gap-2 text-sm leading-relaxed text-slate-800">
            <span className="mt-0.5 shrink-0 font-bold text-emerald-700" aria-hidden>
              ✓
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-600">
        <p>{t("dashboard.patient.report.reviewInputs.summary")}</p>
        <p className="mt-2">{t("dashboard.patient.report.reviewInputs.summarySecondary")}</p>
      </div>
    </div>
  );
}
