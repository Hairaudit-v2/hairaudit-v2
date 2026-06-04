"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

const PRIVACY =
  "This export may include patient-identifying information. Download and store it only in authorised clinical systems according to your clinic privacy policy.";
const CATEGORY_HINT =
  "Use the category export when your CRM/CMS only needs selected image groups.";
const CRM_COPY =
  "Use this export pack only for authorised clinical records or approved CRM/CMS systems.";

type Props = {
  caseId: string;
  /** When a number, shows count and disables at 0. When omitted, button stays enabled (API enforces). */
  surgeryPhotoCount?: number;
  /** Optional `?slot=` filter (must be a valid surgery slot key). */
  slotKey?: string | null;
  className?: string;
  /** Smaller link style for dense layouts (e.g. audit intake queue). */
  variant?: "button" | "link";
};

export default function SurgeryPhotoExportPackButton({
  caseId,
  surgeryPhotoCount,
  slotKey = null,
  className = "",
  variant = "button",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const href = slotKey
    ? `/api/surgery-upload/cases/${encodeURIComponent(caseId)}/photo-export?slot=${encodeURIComponent(slotKey)}`
    : `/api/surgery-upload/cases/${encodeURIComponent(caseId)}/photo-export`;

  const download = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(href, { method: "GET", credentials: "include" });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      let filename = "hairaudit-surgery-photos.zip";
      const m = cd?.match(/filename="([^"]+)"/i);
      if (m?.[1]) filename = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }, [href, router]);

  const disabled =
    typeof surgeryPhotoCount === "number" ? surgeryPhotoCount <= 0 || loading : loading;
  const label =
    typeof surgeryPhotoCount === "number"
      ? surgeryPhotoCount > 0
        ? `Download photo export pack (${surgeryPhotoCount} photo${surgeryPhotoCount === 1 ? "" : "s"})`
        : "No surgery photos available to export."
      : "Download photo export pack";

  if (variant === "link") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => void download()}
          disabled={disabled}
          className={`text-left text-xs font-semibold underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50 ${
            disabled ? "text-slate-400" : "text-cyan-700"
          }`}
        >
          {loading ? "Preparing ZIP…" : "Download surgery photo pack (ZIP)"}
        </button>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        onClick={() => void download()}
        disabled={disabled}
        className={`inline-flex w-full max-w-md items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition sm:w-auto ${
          disabled
            ? "cursor-not-allowed bg-slate-200 text-slate-500"
            : "bg-cyan-600 text-white hover:bg-cyan-700 active:scale-[0.99]"
        }`}
      >
        {loading ? "Preparing download…" : label}
      </button>
      <p className="max-w-xl text-xs text-slate-500">{PRIVACY}</p>
      <p className="max-w-xl text-xs text-slate-500">{CATEGORY_HINT}</p>
      <p className="max-w-xl text-xs text-slate-500">{CRM_COPY}</p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
