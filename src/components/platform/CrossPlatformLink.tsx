"use client";

import { FI_HOME, HA_HOME } from "@/config/platform-links";
import { useI18n } from "@/components/i18n/I18nProvider";

type CrossPlatformLinkMode = "hairAudit" | "follicleIntelligence";

type CrossPlatformLinkProps = {
  mode: CrossPlatformLinkMode;
  className?: string;
  theme?: "default" | "light";
};

export default function CrossPlatformLink({
  mode,
  className = "",
  theme = "default",
}: CrossPlatformLinkProps) {
  const { t } = useI18n();
  const isLight = theme === "light";
  const asideClass = isLight
    ? "rounded-xl border border-slate-200 bg-neutral-50 p-4 sm:p-5"
    : "rounded-xl border border-slate-700 bg-slate-800/40 p-4 sm:p-5";
  const labelClass = isLight
    ? "text-xs uppercase tracking-wider text-slate-500"
    : "text-xs uppercase tracking-wider text-slate-400";
  const messageClass = isLight ? "mt-2 text-sm text-slate-600" : "mt-2 text-sm text-slate-200";

  const message =
    mode === "hairAudit"
      ? t("nav.footer.crossPlatformHairAuditMessage")
      : t("nav.footer.crossPlatformFiMessage");
  const href = mode === "hairAudit" ? FI_HOME : HA_HOME;
  const cta =
    mode === "hairAudit" ? t("nav.footer.crossPlatformVisitFi") : t("nav.ecosystem.exploreHa");

  return (
    <aside className={`${asideClass} ${className}`.trim()}>
      <p className={labelClass}>{t("nav.footer.crossPlatformLabel")}</p>
      <p className={`${messageClass} leading-snug`}>{message}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-600 border border-amber-600/20 text-center leading-snug"
      >
        {cta}
      </a>
    </aside>
  );
}
