"use client";

import { useEffect, useMemo, useState } from "react";
import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import {
  effectivePatientPhotoCategoryKey,
  isPatientUploadAuditExcluded,
  storagePathPatientCategoryFolder,
} from "@/lib/uploads/patientPhotoAuditMeta";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  created_at?: string;
  metadata?: Record<string, unknown> | null;
};

type SignedUrlMap = Record<string, string | null>;

function formatType(type: string) {
  return type.replace(/^patient_photo:|^doctor_photo:/, "").replaceAll("_", " ");
}

function patientEvidenceTitle(upload: UploadRow): string {
  const eff = effectivePatientPhotoCategoryKey(upload);
  if (eff != null) return auditorPatientPhotoCategoryLabel(eff);
  return formatType(upload.type);
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
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-white">Uploaded Evidence</h2>
        <p className="mt-2 text-sm text-slate-100">No uploads yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Uploaded Evidence</h2>
        <span className="rounded-md border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-100">
          {uploads.length} files
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {uploads.map((upload) => {
          const signedUrl = signed[upload.id];
          const typeLabel = patientEvidenceTitle(upload);
          const eff = effectivePatientPhotoCategoryKey(upload);
          const excluded = isPatientUploadAuditExcluded(upload);
          const pathFolder = storagePathPatientCategoryFolder(upload.storage_path);
          const folderNote =
            eff != null && pathFolder != null && pathFolder !== eff ? `Folder: ${pathFolder}` : null;
          return (
            <article
              key={upload.id}
              className={`overflow-hidden rounded-xl border bg-slate-950 transition-all hover:-translate-y-0.5 ${
                excluded ? "border-rose-500/45 hover:border-rose-400/50" : "border-slate-700 hover:border-cyan-300/30"
              }`}
            >
              <div className="relative aspect-square bg-slate-800/70">
                {signedUrl ? (
                  <img src={signedUrl} alt={typeLabel} className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]" />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-400">
                    Thumbnail unavailable
                  </div>
                )}
                {excluded ? (
                  <span className="absolute left-2 top-2 rounded bg-rose-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Excluded
                  </span>
                ) : null}
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-medium text-slate-200">{typeLabel}</p>
                {eff != null ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">Key: {eff}</p>
                ) : (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">Type: {upload.type}</p>
                )}
                {folderNote ? <p className="mt-0.5 truncate text-[10px] text-amber-200/85">{folderNote}</p> : null}
                <p className="mt-1 truncate text-[11px] text-slate-500">{upload.storage_path}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
