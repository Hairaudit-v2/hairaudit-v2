"use client";

import { useState } from "react";

export default function DownloadReport({ pdfPath }: { pdfPath: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/signed-url?path=${encodeURIComponent(pdfPath)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to generate download link");
      if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
      else throw new Error("No URL returned");
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? "Failed to generate download link");
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
