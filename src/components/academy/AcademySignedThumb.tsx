"use client";

import { useEffect, useState } from "react";

export default function AcademySignedThumb({ storagePath, label }: { storagePath: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-900/5">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URLs */}
      <img src={url} alt={label} className="w-full aspect-video object-cover" />
      <div className="px-2 py-1 text-[10px] text-slate-600 truncate">{label}</div>
    </div>
  );
}
