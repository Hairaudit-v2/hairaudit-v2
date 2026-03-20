"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import PortalPlaceholderPanel from "./PortalPlaceholderPanel";

export type ClinicPortalPlaceholderVariant = "settings" | "benchmarking" | "training";

export default function ClinicPortalPlaceholder({ variant }: { variant: ClinicPortalPlaceholderVariant }) {
  const { t } = useI18n();
  const prefix = `dashboard.clinic.placeholders.${variant}` as const;
  return (
    <PortalPlaceholderPanel
      title={t(`${prefix}.title` as TranslationKey)}
      subtitle={t(`${prefix}.subtitle` as TranslationKey)}
      recommendation={t(`${prefix}.recommendation` as TranslationKey)}
    />
  );
}
