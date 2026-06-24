"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type { FutureHairLossRiskResult } from "@/lib/reports/futureHairLossProgressionRisk";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

function bandBadgeClass(band: FutureHairLossRiskResult["band"]): string {
  switch (band) {
    case "low":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "moderate":
      return "border-amber-200 bg-amber-50 text-amber-950";
    default:
      return "border-orange-200 bg-orange-50 text-orange-950";
  }
}

export default function FutureHairLossRiskSection({
  result,
  pathway,
}: {
  result: FutureHairLossRiskResult;
  pathway: PatientReviewPathway;
}) {
  const { t } = useI18n();
  const bandKey =
    `dashboard.patient.report.futureHairLossRisk.band.${result.band}` as TranslationKey;
  const summaryKey =
    `dashboard.patient.report.futureHairLossRisk.summary.${result.band}.${pathway}` as TranslationKey;

  return (
    <div
      data-testid="future-hair-loss-risk-section"
      className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-slate-900">
            {t("dashboard.patient.report.futureHairLossRisk.title")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {t("dashboard.patient.report.futureHairLossRisk.subtitle")}
          </p>
          <span
            className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${bandBadgeClass(result.band)}`}
          >
            {t(bandKey)}
          </span>
        </div>
        <p className="text-3xl font-bold tracking-tight text-sky-700">{result.score}%</p>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-800">{t(summaryKey)}</p>

      {(result.contributingFactors.length > 0 || result.recommendations.length > 0) && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {result.contributingFactors.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("dashboard.patient.report.futureHairLossRisk.contributingFactors")}
              </p>
              <ul className="mt-2 space-y-2">
                {result.contributingFactors.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-slate-800">
                    <span className="mt-0.5 shrink-0 font-bold text-sky-700" aria-hidden>
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.recommendations.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("dashboard.patient.report.futureHairLossRisk.recommendations")}
              </p>
              <ul className="mt-2 space-y-2">
                {result.recommendations.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-slate-800">
                    <span className="mt-0.5 shrink-0 font-bold text-sky-700" aria-hidden>
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
