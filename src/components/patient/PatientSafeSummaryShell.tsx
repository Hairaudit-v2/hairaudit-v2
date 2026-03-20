"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { PatientSafeSummaryObservation } from "@/lib/reports/patientSafeSummary";

function scoreChip(score?: number | null) {
  if (typeof score !== "number") return "border-slate-300/25 bg-slate-300/10 text-slate-100";
  if (score >= 85) return "border-emerald-300/40 bg-emerald-300/20 text-emerald-100";
  if (score >= 70) return "border-lime-300/40 bg-lime-300/20 text-lime-100";
  if (score >= 55) return "border-amber-300/40 bg-amber-300/20 text-amber-100";
  return "border-rose-300/40 bg-rose-300/20 text-rose-100";
}

export default function PatientSafeSummaryShell({
  statusLabel,
  score,
  observations,
  translatedNarrativeActive = false,
}: {
  statusLabel: string;
  score?: number | null;
  observations: PatientSafeSummaryObservation[];
  translatedNarrativeActive?: boolean;
}) {
  const { t } = useI18n();

  const stageLabel = (stage: PatientSafeSummaryObservation["stage"]) =>
    t(`dashboard.patient.safeSummary.stages.${stage}`);

  return (
    <section className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
              {t("dashboard.patient.safeSummary.badges.localizedShell")}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
              {translatedNarrativeActive
                ? t("dashboard.patient.safeSummary.badges.translatedNarrativePilot")
                : t("dashboard.patient.safeSummary.badges.englishNarrative")}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">{t("dashboard.patient.safeSummary.title")}</h2>
          <p className="mt-1 text-sm text-slate-200/80">
            {translatedNarrativeActive
              ? t("dashboard.patient.safeSummary.subtitleTranslated")
              : t("dashboard.patient.safeSummary.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100">
            {t("dashboard.patient.safeSummary.statusLabel")} {statusLabel}
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${scoreChip(score)}`}>
            {t("dashboard.patient.safeSummary.scoreLabel")} {typeof score === "number" ? score : t("reports.status.pending")}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white">{t("dashboard.patient.safeSummary.observationsTitle")}</h3>
        <p className="mt-1 text-xs text-slate-300/80">
          {translatedNarrativeActive
            ? t("dashboard.patient.safeSummary.observationsHintTranslated")
            : t("dashboard.patient.safeSummary.observationsHint")}
        </p>

        {observations.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300/80">{t("dashboard.patient.safeSummary.noObservations")}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {observations.map((item, idx) => (
              <li key={`${item.stage}-${idx}`} className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                    {stageLabel(item.stage)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-100">{item.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-slate-300/80">
          {translatedNarrativeActive
            ? t("dashboard.patient.safeSummary.disclaimerTranslated")
            : t("dashboard.patient.safeSummary.disclaimer")}
        </p>
        <p className="text-xs font-medium text-cyan-100">{t("dashboard.patient.safeSummary.actionPrompt")}</p>
      </div>
    </section>
  );
}
