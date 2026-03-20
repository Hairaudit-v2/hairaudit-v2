"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";

export type CompletionItemKey = "photos" | "procedure" | "graftHandling" | "healingCourse" | "currentStatus";

const ITEM_LABEL: Record<CompletionItemKey, TranslationKey> = {
  photos: "dashboard.patient.completion.itemPhotos",
  procedure: "dashboard.patient.completion.itemProcedure",
  graftHandling: "dashboard.patient.completion.itemGraftHandling",
  healingCourse: "dashboard.patient.completion.itemHealingCourse",
  currentStatus: "dashboard.patient.completion.itemCurrentStatus",
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export default function PatientDashboardCompletionCard({
  nextCaseId,
  completionPct,
  hasAnyCaseData,
  patientPhotoCount,
  photosTarget,
  required,
  modules,
}: {
  nextCaseId: string | null;
  completionPct: number;
  hasAnyCaseData: boolean;
  patientPhotoCount: number;
  photosTarget: number;
  required: { answered: number; total: number; pct: number };
  modules: {
    graftHandling: { answered: number; total: number; pct: number };
    healingCourse: { answered: number; total: number; pct: number };
    currentStatus: { answered: number; total: number; pct: number };
  };
}) {
  const { t } = useI18n();

  const items = [
    {
      key: "photos" as CompletionItemKey,
      done: patientPhotoCount >= 6,
      detail: nextCaseId ? `${patientPhotoCount}/${photosTarget}` : "—",
    },
    {
      key: "procedure" as CompletionItemKey,
      done: required.pct >= 0.95,
      detail: nextCaseId ? `${required.answered}/${required.total}` : "—",
    },
    {
      key: "graftHandling" as CompletionItemKey,
      done: modules.graftHandling.pct >= 0.6,
      detail: nextCaseId ? `${modules.graftHandling.answered}/${modules.graftHandling.total}` : "—",
    },
    {
      key: "healingCourse" as CompletionItemKey,
      done: modules.healingCourse.pct >= 0.6,
      detail: nextCaseId ? `${modules.healingCourse.answered}/${modules.healingCourse.total}` : "—",
    },
    {
      key: "currentStatus" as CompletionItemKey,
      done: modules.currentStatus.pct >= 0.6,
      detail: nextCaseId ? `${modules.currentStatus.answered}/${modules.currentStatus.total}` : "—",
    },
  ].map((row) => ({ ...row, label: t(ITEM_LABEL[row.key]) }));

  const statusLine = !nextCaseId
    ? t("dashboard.patient.completion.noCaseYet")
    : hasAnyCaseData
      ? t("dashboard.patient.completion.live")
      : t("dashboard.patient.completion.notStarted");

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{t("dashboard.patient.completion.title")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300/80">{t("dashboard.patient.completion.subtitle")}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-white tabular-nums">{nextCaseId ? `${completionPct}%` : "—"}</div>
          <div className="text-xs text-slate-300/70">{statusLine}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
            style={{ width: `${nextCaseId ? clamp01(completionPct / 100) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border ${
                  nextCaseId && item.done
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-slate-300/70"
                }`}
                aria-hidden="true"
              >
                {nextCaseId && item.done ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <div>
                <div className="text-sm font-medium text-white">{item.label}</div>
                <div className="text-xs text-slate-300/70">{item.detail}</div>
              </div>
            </div>
            {nextCaseId && !item.done && (
              <span className="text-xs font-medium text-cyan-200/80">{t("dashboard.patient.completion.inProgress")}</span>
            )}
          </div>
        ))}
      </div>

      {nextCaseId && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/cases/${nextCaseId}/patient/questions`}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:from-cyan-200 hover:to-emerald-200"
          >
            {t("dashboard.patient.completion.completeQuestionsCta")}
          </Link>
          <Link
            href={`/cases/${nextCaseId}/patient/photos`}
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 backdrop-blur transition-colors hover:bg-white/10"
          >
            {t("dashboard.patient.completion.addPhotosCta")}
          </Link>
        </div>
      )}
    </section>
  );
}
