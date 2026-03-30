"use client";

import Link from "next/link";
import { trackCta } from "@/lib/analytics/trackCta";
import { useI18n } from "@/components/i18n/I18nProvider";
import { POST_OPERATIVE_HAIR_PROTECTION_GUIDE_PUBLIC_PATH } from "@/lib/constants/patientGuide";
import type { TranslationKey } from "@/lib/i18n/translationKeys";

const BULLET_KEYS = [
  "dashboard.patient.hliGuide.bullet1",
  "dashboard.patient.hliGuide.bullet2",
  "dashboard.patient.hliGuide.bullet3",
  "dashboard.patient.hliGuide.bullet4",
] as const satisfies readonly TranslationKey[];

export default function PatientDashboardHliGuideCard({
  unlocked,
  submitCtaHref,
}: {
  unlocked: boolean;
  /** Case overview (submit) or start-audit entry when no open case exists */
  submitCtaHref: string;
}) {
  const { t } = useI18n();
  const guideHref = POST_OPERATIVE_HAIR_PROTECTION_GUIDE_PUBLIC_PATH;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
      aria-labelledby="hli-guide-card-title"
    >
      <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">
          {t("dashboard.patient.hliGuide.eyebrow")}
        </p>
        <h2 id="hli-guide-card-title" className="mt-2 text-base font-semibold text-white">
          {unlocked ? t("dashboard.patient.hliGuide.titleUnlocked") : t("dashboard.patient.hliGuide.titleLocked")}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-200/80">
          {unlocked ? t("dashboard.patient.hliGuide.bodyUnlocked") : t("dashboard.patient.hliGuide.bodyLocked")}
        </p>

        {unlocked ? (
          <p className="mt-3 text-xs font-medium text-emerald-200/90">{t("dashboard.patient.hliGuide.successLine")}</p>
        ) : null}

        <div className={`relative mt-4 ${unlocked ? "" : "select-none"}`}>
          <ul className={`space-y-2 ${unlocked ? "" : "opacity-40 blur-[0.5px]"}`} aria-hidden={!unlocked}>
            {BULLET_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200/85">
                <span className="mt-0.5 text-amber-300/90" aria-hidden>
                  ·
                </span>
                {t(key)}
              </li>
            ))}
          </ul>

          {!unlocked ? (
            <div
              className="absolute inset-0 flex flex-col justify-end rounded-xl bg-slate-950/65 backdrop-blur-[2px] ring-1 ring-inset ring-white/10"
              aria-hidden
            >
              <div className="p-4 pt-8">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300/90">
                  {t("dashboard.patient.hliGuide.lockedLabel")}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative mt-5">
          {unlocked ? (
            <a
              href={guideHref}
              download
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400/90 to-amber-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:from-amber-300 hover:to-amber-400 sm:w-auto"
              onClick={() => trackCta("cta_download_hli_post_op_guide_dashboard", { href: guideHref })}
            >
              {t("dashboard.patient.hliGuide.unlockedCta")}
            </a>
          ) : (
            <Link
              href={submitCtaHref}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:from-cyan-200 hover:to-emerald-200 sm:w-auto"
              onClick={() => trackCta("cta_submit_audit_unlock_hli_guide", { href: submitCtaHref })}
            >
              {t("dashboard.patient.hliGuide.lockedCta")}
            </Link>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400/90">{t("dashboard.patient.hliGuide.hliAttribution")}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500/90">{t("dashboard.patient.hliGuide.boundaryNote")}</p>
      </div>
    </section>
  );
}
