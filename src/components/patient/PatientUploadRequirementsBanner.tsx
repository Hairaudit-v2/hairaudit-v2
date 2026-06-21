"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import {
  getPathwayEvidencePack,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

export default function PatientUploadRequirementsBanner({
  patientReviewPathway,
}: {
  patientReviewPathway: PatientReviewPathway;
}) {
  const { t } = useI18n();
  const pack = getPathwayEvidencePack(patientReviewPathway);

  return (
    <section
      className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4"
      aria-label="Photo requirements"
    >
      <h2 className="text-sm font-semibold text-slate-900">{t(pack.titleKey as TranslationKey)}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {t(pack.purposeKey as TranslationKey)}
      </p>
      <p className="mt-3 text-xs text-slate-500">
        {t("patient.upload.formatsHint" as TranslationKey)}
      </p>
    </section>
  );
}
