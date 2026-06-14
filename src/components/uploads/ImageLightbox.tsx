"use client";

import { useEffect, useState } from "react";
import { uploadSignedUrlFetchPath } from "@/lib/uploads/uploadSignedUrlClient";

export type LightboxUpload = {
  id: string;
  storage_path: string;
  metadata?: unknown;
};

/**
 * Simple full-screen evidence viewer for reviewers (Stage 3.1). Fetches its own
 * short-lived signed URL from the storage_path — raw storage paths are never
 * exposed in the DOM beyond what the existing signed-url endpoint already gates.
 */
export default function ImageLightbox({
  upload,
  caseId,
  label,
  position,
  count,
  onClose,
}: {
  upload: LightboxUpload;
  /** Optional defense-in-depth: must match the UUID in `upload.storage_path` when set. */
  caseId?: string;
  label: string;
  /** 1-based index of this image within its slot, if known. */
  position?: number;
  /** Total images within the slot, if known. */
  count?: number;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const meta = (upload.metadata ?? {}) as Record<string, unknown>;
  const warning =
    typeof meta.quality_warning === "string" ? meta.quality_warning : null;
  const width = typeof meta.width === "number" ? meta.width : null;
  const height = typeof meta.height === "number" ? meta.height : null;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(uploadSignedUrlFetchPath(upload.storage_path, caseId));
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (json?.url) setUrl(json.url);
        else setError(true);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [upload.storage_path, caseId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} preview`}
      onClick={onClose}
    >
      <div className="flex items-start justify-between gap-3 p-4 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{label}</p>
          <p className="text-xs text-white/70">
            {position && count ? `Image ${position} of ${count}` : count ? `${count} images` : ""}
            {width && height ? `${position || count ? " · " : ""}${width}×${height}px` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
        >
          Close ✕
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-auto px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${label} evidence`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : error ? (
          <p className="text-sm text-white/80">Could not load this image.</p>
        ) : (
          <p className="text-sm text-white/80">Loading…</p>
        )}
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-2 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {warning ? (
          <span className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200">
            ⚠ {warning}
          </span>
        ) : (
          <span />
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
          >
            Open original ↗
          </a>
        )}
      </div>
    </div>
  );
}
