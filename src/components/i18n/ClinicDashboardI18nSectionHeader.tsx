"use client";

import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";
import { useI18n } from "./I18nProvider";

export default function ClinicDashboardI18nSectionHeader() {
  const { t } = useI18n();

  return (
    <ClinicSectionHeader
      title={t("dashboard.clinic.overviewTitle")}
      subtitle={t("dashboard.clinic.overviewSubtitle")}
      actions={[
        { href: "/dashboard/clinic/submit-case", label: t("dashboard.clinic.submitCase"), variant: "primary" },
        { href: "/dashboard/clinic/onboarding", label: t("dashboard.clinic.onboarding") },
      ]}
    />
  );
}
