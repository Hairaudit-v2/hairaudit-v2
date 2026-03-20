"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function BetaBanner() {
  const { t } = useI18n();

  return (
    <div
      className="relative w-full border-b border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 py-2.5 px-4 sm:px-6"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-xs sm:text-sm text-slate-200 leading-snug">
          <span className="font-semibold text-amber-300/95">{t("nav.betaBanner.lead")}</span>{" "}
          {t("nav.betaBanner.detail")}
        </p>
      </div>
    </div>
  );
}
