"use client";

import Link from "next/link";
import { useI18n } from "./I18nProvider";

export default function ClinicDashboardI18nAlerts({
  showClinicWelcomeBanner,
  hasNoSubmittedCases,
}: {
  showClinicWelcomeBanner: boolean;
  hasNoSubmittedCases: boolean;
}) {
  const { t } = useI18n();

  return (
    <>
      {showClinicWelcomeBanner && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
          <p className="font-medium">{t("dashboard.clinic.profileActiveTitle")}</p>
          <p className="mt-1 text-sm text-emerald-800">{t("dashboard.clinic.profileActiveBody")}</p>
        </div>
      )}
      {hasNoSubmittedCases && (
        <div className="mb-6 rounded-xl border-2 border-slate-200 bg-slate-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-900">{t("dashboard.clinic.noCasesTitle")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("dashboard.clinic.noCasesBody")}</p>
          <Link
            href="/dashboard/clinic/submit-case"
            className="mt-4 inline-flex items-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400"
          >
            {t("dashboard.clinic.submitFirstCase")}
          </Link>
        </div>
      )}
    </>
  );
}
