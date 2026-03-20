"use client";

import { SURGICAL_ECOSYSTEM_FOOTER } from "@/lib/constants/platform";
import { useI18n } from "@/components/i18n/I18nProvider";

const ECOSYSTEM_TAG_KEYS = [
  "nav.footer.ecosystemTagTraining",
  "nav.footer.ecosystemTagMeasurement",
  "nav.footer.ecosystemTagAnalysis",
  "nav.footer.ecosystemTagBiology",
] as const;

type SurgicalEcosystemFooterBandProps = {
  theme?: "default" | "light";
};

export default function SurgicalEcosystemFooterBand({
  theme = "default",
}: SurgicalEcosystemFooterBandProps) {
  const { t } = useI18n();
  const isLight = theme === "light";
  const bandClass = isLight
    ? "border-t border-slate-200 bg-neutral-50"
    : "border-t border-slate-700/80 bg-slate-900/80";
  const textClass = isLight
    ? "text-center text-xs uppercase tracking-widest text-slate-500 font-medium mb-3"
    : "text-center text-xs uppercase tracking-widest text-slate-500 font-medium mb-3";
  const linkClass = isLight
    ? "text-slate-600 hover:text-amber-700 transition-colors"
    : "text-slate-400 hover:text-amber-400 transition-colors";
  const labelClass = isLight ? "font-medium text-slate-700" : "font-medium text-slate-300";
  const tagClass = isLight ? "text-slate-500 ml-1" : "text-slate-500 ml-1";

  return (
    <div
      role="contentinfo"
      aria-label={t("nav.footer.ecosystemBandAria")}
      className={bandClass}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <p className={textClass}>{t("nav.footer.ecosystemBandTitle")}</p>
        <nav
          aria-label={t("nav.footer.ecosystemNavAria")}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm"
        >
          {SURGICAL_ECOSYSTEM_FOOTER.map((item, index) => (
            <a
              key={item.label}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              <span className={labelClass}>{item.label}</span>
              <span className={tagClass}>({t(ECOSYSTEM_TAG_KEYS[index])})</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
