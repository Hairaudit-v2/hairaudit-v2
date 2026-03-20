"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function DownloadReport({
  pdfPath,
  label,
}: {
  pdfPath: string;
  /** Optional; defaults to patient reports download label. */
  label?: string;
}) {
  const { t } = useI18n();
  const resolvedLabel = label ?? t("dashboard.reports.downloadPdf");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/signed-url?path=${encodeURIComponent(pdfPath)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? t("reports.errors.downloadLinkFailed"));
      if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
      else throw new Error(t("reports.errors.noUrlReturned"));
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? t("reports.errors.downloadLinkFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={download}
        disabled={busy}
        className="rounded-lg border border-cyan-300/30 bg-cyan-300/15 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/25 disabled:opacity-60"
      >
        {busy ? t("dashboard.reports.downloadPreparing") : resolvedLabel}
      </button>
      {err && <p className="mt-2 text-sm text-red-600">❌ {err}</p>}
    </div>
  );
}
