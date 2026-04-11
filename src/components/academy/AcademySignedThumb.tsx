"use client";

import { useEffect, useState } from "react";

export default function AcademySignedThumb({
  storagePath,
  label,
  uploadId,
  canDelete,
  onDeleted,
}: {
  storagePath: string;
  label: string;
  uploadId?: string;
  canDelete?: boolean;
  onDeleted?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/academy/signed-url?path=${encodeURIComponent(storagePath)}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Could not load");
        if (!cancelled) setUrl(j.url);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  async function remove() {
    if (!uploadId || !canDelete || removing) return;
    if (!confirm("Remove this image from the training case?")) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/academy/uploads/${encodeURIComponent(uploadId)}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not remove");
      onDeleted?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  }

  if (err) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-red-700" title={label}>
        {err}
      </div>
    );
  }
  if (!url) {
    return <div className="aspect-video rounded-lg bg-slate-100 animate-pulse" title={label} />;
  }

  return (
    <div className="relative rounded-lg border border-slate-200 overflow-hidden bg-slate-900/5 group/thumb">
      {canDelete && uploadId ? (
        <button
          type="button"
          onClick={() => void remove()}
          disabled={removing}
          className="absolute top-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-slate-950/75 text-white text-sm font-semibold shadow-sm backdrop-blur-sm hover:bg-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50 sm:opacity-0 sm:group-hover/thumb:opacity-100 transition-opacity"
          aria-label="Remove image"
        >
          {removing ? "…" : "×"}
        </button>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URLs */}
      <img src={url} alt={label} className="w-full aspect-video object-cover" />
      <div className="px-2 py-1 text-[10px] text-slate-600 truncate">{label}</div>
    </div>
  );
}
