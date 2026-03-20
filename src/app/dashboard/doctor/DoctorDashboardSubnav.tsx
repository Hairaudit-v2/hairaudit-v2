"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function DoctorDashboardSubnav() {
  const { t } = useI18n();

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/doctor"
          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
        >
          {t("dashboard.doctor.pageNavOverview")}
        </Link>
        <Link
          href="/dashboard/doctor/onboarding"
          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
        >
          {t("dashboard.doctor.pageNavOnboarding")}
        </Link>
      </div>
    </section>
  );
}
