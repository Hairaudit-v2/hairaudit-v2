"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import {
  buildPostSurgeryVisualSummary,
  buildPreSurgeryVisualSummary,
  type PathwayVisualSummary,
} from "@/lib/reports/pathwayVisualSummary";
import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import type { PreSurgeryPlanningReport } from "@/lib/reports/preSurgeryPlanningReport";

function legendToneClass(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("within expected") || lower.includes("generally acceptable")) {
    return "border-emerald-200 bg-emerald-50/70 text-emerald-950";
  }
  if (lower.includes("under review") || lower.includes("limited photo")) {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }
  return "border-amber-200 bg-amber-50/70 text-amber-950";
}

export default function PathwayVisualSummarySection({
  pathway,
  postReport,
  preReport,
}: {
  pathway: PatientReviewPathway;
  postReport?: PostSurgeryAuditReport | null;
  preReport?: PreSurgeryPlanningReport | null;
}) {
  const { t } = useI18n();

  const summary: PathwayVisualSummary = useMemo(() => {
    const domainLabels = {
      donor_preservation: t("dashboard.patient.pathwayVisualSummary.domains.donor_preservation"),
      extraction_pattern: t("dashboard.patient.pathwayVisualSummary.domains.extraction_pattern"),
      density_distribution: t("dashboard.patient.pathwayVisualSummary.domains.density_distribution"),
      recipient_area: t("dashboard.patient.pathwayVisualSummary.domains.recipient_area"),
      healing_quality: t("dashboard.patient.pathwayVisualSummary.domains.healing_quality"),
      hair_loss_progression_risk: t(
        "dashboard.patient.pathwayVisualSummary.domains.hair_loss_progression_risk"
      ),
      donor_area_strength: t("dashboard.patient.pathwayVisualSummary.domains.donor_area_strength"),
      restoration_suitability: t(
        "dashboard.patient.pathwayVisualSummary.domains.restoration_suitability"
      ),
      long_term_preservation_score: t(
        "dashboard.patient.pathwayVisualSummary.domains.long_term_preservation_score"
      ),
      treatment_stabilisation_priority: t(
        "dashboard.patient.pathwayVisualSummary.domains.treatment_stabilisation_priority"
      ),
    };

    const labels = {
      title: t("dashboard.patient.pathwayVisualSummary.title"),
      subtitle: t("dashboard.patient.pathwayVisualSummary.subtitle"),
      emptyMessage: t("dashboard.patient.pathwayVisualSummary.emptyMessage"),
      domainLabels,
    };

    if (pathway === "post_surgery" && postReport) {
      return buildPostSurgeryVisualSummary(postReport, { labels });
    }
    if (pathway === "pre_surgery" && preReport) {
      return buildPreSurgeryVisualSummary(preReport, { labels });
    }
    return {
      status: "insufficient" as const,
      title: labels.title,
      subtitle: labels.subtitle,
      domains: [],
      centerLabel: "",
      emptyMessage: labels.emptyMessage,
      radarSvg: null,
    };
  }, [pathway, postReport, preReport, t]);

  return (
    <div
      data-testid="pathway-visual-summary"
      data-status={summary.status}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-semibold text-slate-900">{summary.title}</h3>
      <p className="mt-1 text-sm text-slate-600">{summary.subtitle}</p>

      {summary.status === "ready" && summary.radarSvg ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div
            className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3"
            dangerouslySetInnerHTML={{ __html: summary.radarSvg }}
          />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {summary.domains.map((domain) => (
              <li
                key={domain.id}
                className={`rounded-xl border px-3 py-2.5 ${legendToneClass(domain.qualitativeLabel)}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  {t(
                    `dashboard.patient.pathwayVisualSummary.domains.${domain.id}` as TranslationKey
                  )}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug">{domain.qualitativeLabel}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
          {summary.emptyMessage}
        </p>
      )}
    </div>
  );
}
