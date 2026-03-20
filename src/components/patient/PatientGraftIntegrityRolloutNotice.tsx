"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function PatientGraftIntegrityRolloutNotice() {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-sm font-semibold text-white">{t("dashboard.patient.graftIntegrity.rolloutTitle")}</h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-300/80">{t("dashboard.patient.graftIntegrity.rolloutBody")}</p>
    </section>
  );
}
