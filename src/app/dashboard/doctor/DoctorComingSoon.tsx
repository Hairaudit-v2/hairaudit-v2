"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";

type DoctorComingSoonProps = {
  title: string;
  description: string;
  alternative?: { label: string; href: string };
};

export default function DoctorComingSoon({ title, description, alternative }: DoctorComingSoonProps) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t("dashboard.doctor.comingSoonEyebrow")}
      </p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/doctor"
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
        >
          {t("dashboard.doctor.placeholderBackToOverview")}
        </Link>
        {alternative && (
          <Link
            href={alternative.href}
            className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {alternative.label}
          </Link>
        )}
      </div>
    </div>
  );
}
