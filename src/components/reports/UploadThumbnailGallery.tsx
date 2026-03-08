"use client";

import { useEffect, useMemo, useState } from "react";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  created_at?: string;
};

type SignedUrlMap = Record<string, string | null>;

function formatType(type: string) {
  return type.replace(/^patient_photo:|^doctor_photo:/, "").replaceAll("_", " ");
}

export default function UploadThumbnailGallery({ uploads }: { uploads: UploadRow[] }) {
  const [signed, setSigned] = useState<SignedUrlMap>({});

  const imageUploads = useMemo(
    () =>
      (uploads ?? []).filter((upload) => {
        const t = String(upload.type ?? "").toLowerCase();
        return t.includes("photo") || t.includes("image") || t.includes("jpg") || t.includes("png") || t.includes("webp");
      }),
    [uploads]
  );

  useEffect(() => {
    let active = true;

    async function loadSignedUrls() {
      const entries = await Promise.all(
        imageUploads.map(async (upload) => {
          try {
            const res = await fetch(`/api/uploads/signed-url?path=${encodeURIComponent(upload.storage_path)}`);
            const json = await res.json().catch(() => ({}));
            return [upload.id, json?.url ?? null] as const;
          } catch {
            return [upload.id, null] as const;
          }
        })
      );
      if (!active) return;
      setSigned(Object.fromEntries(entries));
    }

    if (imageUploads.length > 0) loadSignedUrls();
    return () => {
      active = false;
    };
  }, [imageUploads]);

  if (!uploads || uploads.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white">Uploaded Evidence</h2>
        <p className="mt-2 text-sm text-slate-300/80">No uploads yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Uploaded Evidence</h2>
        <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-xs text-slate-300">
          {uploads.length} files
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {uploads.map((upload) => {
          const signedUrl = signed[upload.id];
          const typeLabel = formatType(upload.type);
          return (
            <article key={upload.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
              <div className="aspect-square bg-slate-800/70">
                {signedUrl ? (
                  <img src={signedUrl} alt={typeLabel} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-400">
                    Thumbnail unavailable
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-300">{typeLabel}</p>
                <p className="mt-1 truncate text-[11px] text-slate-400">{upload.storage_path}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
