"use client";

import { useState } from "react";
import { getReportDownloadUrl } from "./actions";

export default function DownloadReport({ pdfPath }: { pdfPath: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    setErr(null);
    setBusy(true);
    try {
      const url = await getReportDownloadUrl(pdfPath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to generate download link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={download}
        disabled={busy}
        className="rounded-lg px-3 py-2 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:opacity-60"
      >
        {busy ? "Preparing…" : "Download PDF"}
      </button>
      {err && <p className="mt-2 text-sm text-red-600">❌ {err}</p>}
    </div>
  );
}
