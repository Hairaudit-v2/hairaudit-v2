"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import ClinicSectionHeader from "./ClinicSectionHeader";

export default function PortalPlaceholderPanel({
  title,
  subtitle,
  recommendation,
}: {
  title: string;
  subtitle: string;
  recommendation: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <ClinicSectionHeader
        title={title}
        subtitle={subtitle}
        badge={t("dashboard.shared.comingSoonBadge")}
        actions={[
          {
            href: "/dashboard/clinic",
            label: t("dashboard.clinic.placeholderBackToOverview"),
          },
        ]}
      />
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm leading-relaxed text-slate-700">{recommendation}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/clinic/profile"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("dashboard.clinic.placeholderManageProfile")}
          </Link>
          <Link
            href="/dashboard/clinic/workspaces"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("dashboard.clinic.placeholderInvitedContributions")}
          </Link>
        </div>
      </div>
    </div>
  );
}
