"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { cn } from "@/lib/utils";

const ITEM_KEYS: TranslationKey[] = [
  "marketing.patientPhoto.itemFront",
  "marketing.patientPhoto.itemLeft",
  "marketing.patientPhoto.itemRight",
  "marketing.patientPhoto.itemTop",
  "marketing.patientPhoto.itemDonor",
  "marketing.patientPhoto.itemPostOp",
  "marketing.patientPhoto.itemDocs",
];

type PatientPhotoChecklistProps = {
  className?: string;
  id?: string;
  /** `ink` matches dark public pages; `fi` matches HairAuditFiMarketingShell tokens. */
  surface?: "ink" | "fi";
};

/**
 * Simple photo checklist for ESL-friendly patient copy on marketing surfaces.
 */
export default function PatientPhotoChecklist({
  className,
  id = "patient-photo-checklist",
  surface = "ink",
}: PatientPhotoChecklistProps) {
  const { t } = useI18n();

  const shell =
    surface === "fi"
      ? "rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel"
      : "rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm";

  const heading = surface === "fi" ? "text-lg font-semibold text-foreground" : "text-lg font-semibold text-white";

  const introClass =
    surface === "fi" ? "mt-2 text-sm text-muted-foreground leading-relaxed" : "mt-2 text-sm text-slate-400 leading-relaxed";

  const itemShell =
    surface === "fi"
      ? "min-w-0 rounded-xl border border-border/50 bg-background/60 px-4 py-2.5 text-sm text-foreground leading-snug break-words"
      : "min-w-0 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-200 leading-snug break-words";

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn(shell, className)}>
      <h2 id={`${id}-heading`} className={heading}>
        {t("marketing.patientPhoto.title")}
      </h2>
      <p className={introClass}>{t("marketing.patientPhoto.intro")}</p>
      <ul className="mt-4 grid min-w-0 gap-2.5 sm:grid-cols-2">
        {ITEM_KEYS.map((key) => (
          <li key={key} className={itemShell}>
            {t(key)}
          </li>
        ))}
      </ul>
    </section>
  );
}
