"use client";

import { useEffect, useState } from "react";

export default function UploadedThumb({
  upload,
  locked,
  onDeleted,
}: {
  upload: any;
  caseId?: string;
  locked?: boolean;
  onDeleted: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = (upload?.metadata ?? {}) as Record<string, unknown>;
  const mime = String(meta.mime ?? "").toLowerCase();
  const path = String(upload?.storage_path ?? "").toLowerCase();
  const isImageByExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic", ".heif"].some((ext) => path.endsWith(ext));
  const isImage = mime ? mime.startsWith("image/") : isImageByExt;

  useEffect(() => {
    let alive = true;

    async function load() {
      const res = await fetch(`/api/uploads/signed-url?path=${encodeURIComponent(upload.storage_path)}`);
      const json = await res.json();
      if (!alive) return;
      setUrl(json?.url ?? null);
    }

    load();
    return () => { alive = false; };
  }, [upload.storage_path]);

  async function del() {
    if (locked) return;
    if (!confirm("Delete this photo?")) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/uploads/delete?uploadId=${encodeURIComponent(upload.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      onDeleted();
    } catch (e: any) {
      alert(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border p-2">
      <div className="aspect-square w-full overflow-hidden rounded-md bg-gray-100">
        {url ? isImage ? (
          <img src={url} alt="Case evidence thumbnail" className="h-full w-full object-cover" />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-slate-700 hover:underline"
          >
            Open file
          </a>
        ) : (
          <div className="p-2 text-xs text-gray-500">Loading…</div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-600">{isImage ? "Image" : "File"}</span>
        <button
          onClick={del}
          disabled={busy || locked}
          className="text-xs underline disabled:opacity-50"
        >
          {locked ? "Locked" : busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}