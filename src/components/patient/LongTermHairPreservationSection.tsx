"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import type { LongTermPreservationSubsectionId } from "@/lib/reports/longTermHairPreservation";

const SUBSECTION_ORDER: LongTermPreservationSubsectionId[] = [
  "medical",
  "natural",
  "regenerative",
  "monitoring",
];

const EXAMPLES_KEYS: Record<
  LongTermPreservationSubsectionId,
  TranslationKey
> = {
  medical: "dashboard.patient.report.longTermPreservation.medical.examplesLead",
  natural: "dashboard.patient.report.longTermPreservation.natural.examplesLead",
  regenerative: "dashboard.patient.report.longTermPreservation.regenerative.examplesLead",
  monitoring: "dashboard.patient.report.longTermPreservation.monitoring.examplesLead",
};

export default function LongTermHairPreservationSection({
  pathway,
}: {
  pathway: PatientReviewPathway;
}) {
  const { t } = useI18n();
  const pathwayKey =
    `dashboard.patient.report.longTermPreservation.pathwayContext.${pathway}` as TranslationKey;

  return (
    <div
      data-testid="long-term-preservation-section"
      className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-semibold text-sky-950">
        {t("dashboard.patient.report.longTermPreservation.title")}
      </h3>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-sky-800/80">
        {t(pathwayKey)}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-sky-950/90">
        {t("dashboard.patient.report.longTermPreservation.intro.paragraph1")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-sky-950/90">
        {t("dashboard.patient.report.longTermPreservation.intro.paragraph2")}
      </p>

      <div className="mt-5 space-y-5">
        {SUBSECTION_ORDER.map((id) => {
          const titleKey =
            `dashboard.patient.report.longTermPreservation.${id}.title` as TranslationKey;
          const introKey =
            id === "regenerative"
              ? (`dashboard.patient.report.longTermPreservation.regenerative.intro.${pathway}` as TranslationKey)
              : (`dashboard.patient.report.longTermPreservation.${id}.intro` as TranslationKey);
          const explanationKey =
            `dashboard.patient.report.longTermPreservation.${id}.explanation` as TranslationKey;
          const examplesBase =
            `dashboard.patient.report.longTermPreservation.${id}.examples` as const;
          const exampleCount =
            id === "medical" ? 2 : id === "regenerative" ? 4 : id === "natural" ? 5 : 5;
          const examples = Array.from({ length: exampleCount }, (_, i) =>
            t(`${examplesBase}.${i}` as TranslationKey)
          );

          return (
            <div
              key={id}
              className="border-t border-sky-200/70 pt-4 first:border-t-0 first:pt-0"
            >
              <h4 className="text-sm font-semibold text-sky-950">{t(titleKey)}</h4>
              <p className="mt-2 text-sm leading-relaxed text-sky-950/85">{t(introKey)}</p>
              <p className="mt-2 text-xs font-medium text-sky-900/70">{t(EXAMPLES_KEYS[id])}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-sky-950/85">
                {examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm leading-relaxed text-sky-950/85">
                {t(explanationKey)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-amber-200/90 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-950/90">
        {t("dashboard.patient.report.longTermPreservation.safety")}
      </div>
    </div>
  );
}
