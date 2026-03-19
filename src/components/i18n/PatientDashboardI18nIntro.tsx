"use client";

import Link from "next/link";
import CreateCaseButton from "@/app/dashboard/create-case-button";
import { useI18n } from "./I18nProvider";

type NextCase = { id: string } | null;

export default function PatientDashboardI18nIntro({
  showConversionPrompt,
  nextCase,
  benchmarkingLine,
}: {
  showConversionPrompt: boolean;
  nextCase: NextCase;
  benchmarkingLine: string;
}) {
  const { t } = useI18n();

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5">
          <div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">{t("dashboard.patient.heroTitle")}</h1>
            <p className="mt-2 text-sm sm:text-base text-slate-200/80 max-w-2xl">{t("dashboard.patient.heroSubtitle")}</p>
          </div>

          {showConversionPrompt && (
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3 text-sm text-slate-200">
              {t("dashboard.patient.conversionPrompt")}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            {nextCase?.id ? (
              <Link
                href={`/cases/${nextCase.id}/patient/questions`}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors shadow-sm"
              >
                {t("dashboard.patient.completeQuestions")}
              </Link>
            ) : (
              <CreateCaseButton variant="premium" />
            )}

            <a
              href="#unlock-preview"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-200 border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur transition-colors"
            >
              {t("dashboard.patient.seeUnlock")}
            </a>
          </div>

          <div className="pt-2 text-xs leading-relaxed text-slate-300/70">
            <div>{t("dashboard.patient.poweredBy")}</div>
            <div>{t("dashboard.patient.mlEngine")}</div>
            <div>{t("dashboard.patient.visionModel")}</div>
            <div className="mt-1 text-slate-400/90">{benchmarkingLine}</div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CreateCaseButton variant="card" label={t("dashboard.shared.startNewAudit")} />
        <Link
          href={nextCase?.id ? `/cases/${nextCase.id}/patient/photos` : "/dashboard/patient"}
          className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold leading-snug text-slate-900 hover:border-amber-300 hover:shadow-sm"
        >
          {t("dashboard.patient.uploadPhotos")}
        </Link>
        <Link
          href={nextCase?.id ? `/cases/${nextCase.id}/patient/questions` : "/dashboard/patient"}
          className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold leading-snug text-slate-900 hover:border-amber-300 hover:shadow-sm"
        >
          {t("dashboard.patient.completeIntake")}
        </Link>
        <Link
          href="/dashboard/patient/reports"
          className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold leading-snug text-slate-900 hover:border-amber-300 hover:shadow-sm"
        >
          {t("dashboard.patient.viewReports")}
        </Link>
      </section>
    </>
  );
}
