"use client";

import { useEffect } from "react";
import { useI18n } from "./I18nProvider";
import { getTextDirection } from "@/lib/i18n/constants";

/** Keeps document `lang` and `dir` aligned with active UI locale (RTL-ready). */
export default function I18nHtmlLang() {
  const { locale } = useI18n();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getTextDirection(locale);
  }, [locale]);

  return null;
}
