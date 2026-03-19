"use client";

import { useI18n } from "./I18nProvider";
import { LOCALE_REGISTRY, type SupportedLocale } from "@/lib/i18n/constants";

type LanguageSwitcherProps = {
  /** Tailwind-friendly classes for the native select */
  className?: string;
  variant?: "default" | "light";
};

export default function LanguageSwitcher({ className = "", variant = "default" }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const baseSelect =
    "rounded-lg border bg-transparent px-2 py-1.5 text-[13px] xl:text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 " +
    (variant === "light"
      ? "border-slate-300 text-slate-700"
      : "border-slate-600 text-slate-200");

  const enabledLocales = LOCALE_REGISTRY.filter((e) => e.enabled);

  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="sr-only">{t("nav.language")}</span>
      <select
        aria-label={t("nav.language")}
        className={baseSelect}
        value={locale}
        onChange={(e) => setLocale(e.target.value as SupportedLocale)}
      >
        {enabledLocales.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
