"use client";

import Link from "next/link";
import { useI18n } from "./I18nProvider";

export default function PatientReportsI18nHeader({ benchmarkingLine }: { benchmarkingLine: string }) {
  const { t } = useI18n();

  return (
    <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <Link
          href="/dashboard/patient"
          className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          {t("dashboard.reports.back")}
        </Link>
        <h1 className="mt-2 text-xl sm:text-2xl font-semibold text-white">{t("dashboard.reports.title")}</h1>
        <p className="mt-1 text-sm text-slate-200/70">{t("dashboard.reports.subtitle")}</p>
        <p className="mt-1 text-xs text-slate-400/90">{benchmarkingLine}</p>
      </div>
    </div>
  );
}
