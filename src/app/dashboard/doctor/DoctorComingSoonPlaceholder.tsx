"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import DoctorComingSoon from "./DoctorComingSoon";

export type DoctorComingSoonPlaceholderVariant =
  | "publicProfile"
  | "training"
  | "defaults"
  | "reports"
  | "upload";

function alternativeFor(
  variant: DoctorComingSoonPlaceholderVariant,
  t: (key: TranslationKey) => string
): { label: string; href: string } | undefined {
  if (variant === "publicProfile") {
    return {
      label: t("dashboard.doctor.placeholders.publicProfile.altCta"),
      href: "/leaderboards/doctors",
    };
  }
  if (variant === "upload") {
    return {
      label: t("dashboard.doctor.placeholders.upload.altCta"),
      href: "/dashboard/doctor",
    };
  }
  return {
    label: t("dashboard.doctor.placeholders.common.goToOverview"),
    href: "/dashboard/doctor",
  };
}

export default function DoctorComingSoonPlaceholder({ variant }: { variant: DoctorComingSoonPlaceholderVariant }) {
  const { t } = useI18n();
  const prefix = `dashboard.doctor.placeholders.${variant}` as const;
  return (
    <DoctorComingSoon
      title={t(`${prefix}.title` as TranslationKey)}
      description={t(`${prefix}.description` as TranslationKey)}
      alternative={alternativeFor(variant, t)}
    />
  );
}
