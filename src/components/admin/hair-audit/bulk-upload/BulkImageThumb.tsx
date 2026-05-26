"use client";

import { useEffect, useState } from "react";

export default function BulkImageThumb({
  storagePath,
  fileName,
}: {
  storagePath: string;
  fileName: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/hair-audit/bulk-upload/signed-url?path=${encodeURIComponent(storagePath)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.ok && j.url) setUrl(j.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-md bg-slate-800">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={fileName ?? "Uploaded image"} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-slate-500">Loading…</div>
      )}
    </div>
  );
}
