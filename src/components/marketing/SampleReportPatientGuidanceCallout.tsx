"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";

const LI_KEYS = [
  "marketing.sampleReport.patientGuidanceLi1",
  "marketing.sampleReport.patientGuidanceLi2",
  "marketing.sampleReport.patientGuidanceLi3",
] as const satisfies readonly TranslationKey[];

export default function SampleReportPatientGuidanceCallout() {
  const { t } = useI18n();

  return (
    <section
      className="px-4 sm:px-6 pb-10 sm:pb-12"
      aria-labelledby="sample-report-patient-guidance-heading"
    >
      <div>
        <div className="mx-auto max-w-5xl rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-6 backdrop-blur sm:px-8 sm:py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
            {t("marketing.sampleReport.patientGuidanceEyebrow")}
          </p>
          <h2
            id="sample-report-patient-guidance-heading"
            className="mt-2 text-lg font-semibold text-white sm:text-xl"
          >
            {t("marketing.sampleReport.patientGuidanceTitle")}
          </h2>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            {t("marketing.sampleReport.patientGuidanceLead")}
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
            {LI_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2.5">
                <span className="text-cyan-300 mt-0.5 flex-shrink-0" aria-hidden>
                  ·
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
