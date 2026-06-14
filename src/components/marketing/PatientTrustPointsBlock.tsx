"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { cn } from "@/lib/utils";

const POINTS: { title: TranslationKey; body: TranslationKey }[] = [
  { title: "marketing.patientTrust.independentTitle", body: "marketing.patientTrust.independentBody" },
  { title: "marketing.patientTrust.privacyTitle", body: "marketing.patientTrust.privacyBody" },
  { title: "marketing.patientTrust.notMarketingTitle", body: "marketing.patientTrust.notMarketingBody" },
  { title: "marketing.patientTrust.humanReviewTitle", body: "marketing.patientTrust.humanReviewBody" },
  { title: "marketing.patientTrust.secureUploadTitle", body: "marketing.patientTrust.secureUploadBody" },
  { title: "marketing.patientTrust.notEmergencyTitle", body: "marketing.patientTrust.notEmergencyBody" },
];

type PatientTrustPointsBlockProps = {
  className?: string;
  id?: string;
};

export default function PatientTrustPointsBlock({
  className,
  id = "patient-trust-points",
}: PatientTrustPointsBlockProps) {
  const { t } = useI18n();

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6 sm:p-7", className)}
    >
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-emerald-100">
        {t("marketing.patientTrust.sectionTitle")}
      </h2>
      <ul className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
        {POINTS.map(({ title, body }) => (
          <li
            key={title}
            className="min-w-0 rounded-xl border border-white/10 bg-slate-950/40 p-4"
          >
            <p className="text-sm font-semibold text-white break-words">{t(title)}</p>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed break-words">{t(body)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
