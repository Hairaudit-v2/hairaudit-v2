"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  SURGERY_PHOTO_SLOTS,
  slotFromSurgeryType,
  type SurgeryPhotoSlotKey,
} from "@/lib/surgeryUpload/checklist";
import { countSurgeryPhotosBySlot } from "@/lib/surgeryUpload/photoExportPack";
import type { PhotoExportHistoryItem } from "@/lib/surgeryUpload/photoExportHistory";

const PRIVACY =
  "This export may include patient-identifying information. Download and store it only in authorised clinical systems according to your clinic privacy policy.";
const CATEGORY_HINT =
  "Use the category export when your CRM/CMS only needs selected image groups.";
const CRM_COPY =
  "Use this export pack only for authorised clinical records or approved CRM/CMS systems.";

type UploadLite = { type: string };

type Props = {
  caseId: string;
  uploads: UploadLite[];
  exportHistory?: PhotoExportHistoryItem[];
};

export default function SurgeryPhotoExportPackPanel({
  caseId,
  uploads,
  exportHistory = [],
}: Props) {
  const slotsWithCounts = useMemo(() => {
    const counts = countSurgeryPhotosBySlot(uploads);
    return SURGERY_PHOTO_SLOTS.map((s) => ({
      key: s.key,
      label: s.label,
      count: counts.get(s.key) ?? 0,
    })).filter((x) => x.count > 0);
  }, [uploads]);

  const totalSurgery = useMemo(
    () => uploads.filter((u) => slotFromSurgeryType(u.type) !== null).length,
    [uploads]
  );

  const [selected, setSelected] = useState<Set<SurgeryPhotoSlotKey>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/api/surgery-upload/cases/${encodeURIComponent(caseId)}/photo-export`;

  const download = useCallback(async (href: string) => {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSlot = useCallback((key: SurgeryPhotoSlotKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectedPhotoCount = useMemo(() => {
    const map = new Map(slotsWithCounts.map((s) => [s.key, s.count]));
    let n = 0;
    for (const k of selected) n += map.get(k) ?? 0;
    return n;
  }, [selected, slotsWithCounts]);

  const onDownloadAll = useCallback(() => {
    void download(basePath);
  }, [basePath, download]);

  const onDownloadOne = useCallback(
    (key: SurgeryPhotoSlotKey) => {
      void download(`${basePath}?slot=${encodeURIComponent(key)}`);
    },
    [basePath, download]
  );

  const onDownloadSelected = useCallback(() => {
    if (selected.size === 0) return;
    const keys = SURGERY_PHOTO_SLOTS.map((s) => s.key).filter((k) => selected.has(k));
    if (keys.length === 0) return;
    if (keys.length === 1) {
      void download(`${basePath}?slot=${encodeURIComponent(keys[0]!)}`);
      return;
    }
    void download(`${basePath}?slots=${encodeURIComponent(keys.join(","))}`);
  }, [basePath, download, selected]);

  const disabledAll = totalSurgery <= 0 || loading;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={onDownloadAll}
          disabled={disabledAll}
          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition sm:w-auto ${
            disabledAll
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
              : "bg-cyan-600 text-white hover:bg-cyan-700 active:scale-[0.99]"
          }`}
        >
          {loading ? "Preparing download…" : `Download all surgery photos (${totalSurgery})`}
        </button>
      </div>

      {slotsWithCounts.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Categories with photos
          </p>
          <ul className="mt-2 space-y-2">
            {slotsWithCounts.map(({ key, label, count }) => (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggleSlot(key)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600"
                  />
                  <span className="truncate text-sm text-slate-800">
                    {label} — {count} photo{count === 1 ? "" : "s"}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => onDownloadOne(key)}
                  disabled={loading}
                  className="shrink-0 text-xs font-semibold text-cyan-700 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Download category
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onDownloadSelected}
            disabled={loading || selected.size === 0}
            className={`mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold sm:w-auto ${
              loading || selected.size === 0
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "border border-cyan-300 bg-cyan-50 text-cyan-900 hover:bg-cyan-100"
            }`}
          >
            {loading
              ? "Preparing…"
              : `Download selected (${selected.size} categor${selected.size === 1 ? "y" : "ies"}, ${selectedPhotoCount} photo${selectedPhotoCount === 1 ? "" : "s"})`}
          </button>
        </div>
      )}

      <p className="max-w-xl text-xs text-slate-500">{PRIVACY}</p>
      <p className="max-w-xl text-xs text-slate-500">{CATEGORY_HINT}</p>
      <p className="max-w-xl text-xs text-slate-500">{CRM_COPY}</p>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {exportHistory.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Recent export activity
          </p>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-slate-700">
            {exportHistory.map((row) => (
              <li key={row.id} className="border-b border-slate-100 pb-2 last:border-0">
                <div className="flex flex-wrap justify-between gap-1">
                  <span className="font-medium text-slate-800">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                  <span
                    className={
                      row.status === "completed"
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-rose-700"
                    }
                  >
                    {row.status === "completed" ? "Completed" : "Failed"}
                  </span>
                </div>
                <p className="mt-0.5 text-slate-600">
                  {row.actorLabel} · {row.scopeSummary} · {row.photoCount} photo
                  {row.photoCount === 1 ? "" : "s"}
                </p>
                {row.status === "failed" && row.errorSummary && (
                  <p className="mt-0.5 text-rose-700">{row.errorSummary}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
