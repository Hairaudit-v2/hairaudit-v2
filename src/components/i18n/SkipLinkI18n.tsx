"use client";

import { useI18n } from "./I18nProvider";

/** First focusable skip link; must stay inside {@link I18nProvider}. */
export default function SkipLinkI18n() {
  const { t } = useI18n();

  return (
    <a href="#main-content" className="skip-link">
      {t("nav.skipToMain")}
    </a>
  );
}
