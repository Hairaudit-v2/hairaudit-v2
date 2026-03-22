"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function DownloadReport({
  reportId,
  label,
}: {
  reportId: string;
  /** Optional; defaults to patient reports download label. */
  label?: string;
}) {
  const { t } = useI18n();
  const resolvedLabel = label ?? t("dashboard.reports.downloadPdf");
  const href = `/api/reports/${encodeURIComponent(reportId)}/download`;

  return (
    <div>
      <a
        href={href}
        className="inline-flex items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/15 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/25"
      >
        {resolvedLabel}
      </a>
    </div>
  );
}
