"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function DoctorOnboardingPageHeader() {
  const { t } = useI18n();
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {t("dashboard.doctor.onboardingPageTitle")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("dashboard.doctor.onboardingPageSubtitle")}</p>
      </div>
      <Link
        href="/dashboard/doctor"
        className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {t("dashboard.doctor.pageNavOverview")}
      </Link>
    </div>
  );
}
