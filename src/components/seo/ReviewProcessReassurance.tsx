"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

type ReviewProcessReassuranceProps = {
  className?: string;
};

export default function ReviewProcessReassurance({ className = "" }: ReviewProcessReassuranceProps) {
  const { t } = useI18n();

  return (
    <div className={`rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 ${className}`}>
      <h3 className="text-base font-semibold text-emerald-200">
        {t("marketing.shared.reviewAfterSubmitTitle")}
      </h3>
      <ul className="mt-3 space-y-2 text-sm text-emerald-100/90">
        <li>{t("marketing.shared.reviewAfterSubmitLi1")}</li>
        <li>{t("marketing.shared.reviewAfterSubmitLi2")}</li>
        <li>{t("marketing.shared.reviewAfterSubmitLi3")}</li>
        <li>{t("marketing.shared.reviewAfterSubmitLi4")}</li>
      </ul>
      <p className="mt-3 text-xs text-emerald-100/80">{t("marketing.shared.reviewIndependentNote")}</p>
    </div>
  );
}
