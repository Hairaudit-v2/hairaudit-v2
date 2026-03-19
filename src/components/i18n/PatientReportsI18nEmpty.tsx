"use client";

import Link from "next/link";
import { useI18n } from "./I18nProvider";

export default function PatientReportsI18nEmpty() {
  const { t } = useI18n();

  return (
    <div className="relative mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <p className="text-slate-200/80 mb-4">{t("dashboard.reports.empty")}</p>
      <Link
        href="/dashboard/patient"
        className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors"
      >
        {t("dashboard.reports.goToDashboard")}
      </Link>
    </div>
  );
}
