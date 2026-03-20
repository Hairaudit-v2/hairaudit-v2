"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function PatientDashboardWhyMattersSection() {
  const { t } = useI18n();

  const cards = [
    { id: "donor", title: t("dashboard.patient.whyMatters.donorRiskTitle"), desc: t("dashboard.patient.whyMatters.donorRiskDesc") },
    { id: "survival", title: t("dashboard.patient.whyMatters.survivalTitle"), desc: t("dashboard.patient.whyMatters.survivalDesc") },
    { id: "projection", title: t("dashboard.patient.whyMatters.projectionTitle"), desc: t("dashboard.patient.whyMatters.projectionDesc") },
  ];

  return (
    <section className="relative mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("dashboard.patient.whyMatters.title")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-200/70">{t("dashboard.patient.whyMatters.subtitle")}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur"
          >
            <div className="text-sm font-semibold text-white">{c.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-200/70">{c.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
