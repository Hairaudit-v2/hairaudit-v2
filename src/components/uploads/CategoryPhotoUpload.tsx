"use client";

import React, { useMemo, useState } from "react";
import UploadedThumb from "./UploadedThumb";

type CategoryDef = { key: string; title: string; required?: boolean; help?: string; tips?: readonly string[]; maxFiles: number; accept: string };

type UploadRow = { id: string; type: string; storage_path: string; metadata: unknown; created_at: string };

export default function CategoryPhotoUpload({
  caseId,
  initialUploads,
  caseStatus,
  submittedAt,
  typePrefix,
  categories,
  uploadApiUrl,
}: {
  caseId: string;
  initialUploads: UploadRow[];
  caseStatus: string;
  submittedAt?: string | null;
  typePrefix: string;
  categories: readonly CategoryDef[];
  uploadApiUrl: string;
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [busyCats, setBusyCats] = useState<Record<string, boolean>>({});
  const isLocked = caseStatus === "submitted" || !!submittedAt;

  const uploadsByCategory = useMemo(() => {
    const map: Record<string, UploadRow[]> = {};
    for (const u of uploads) {
      if (!u.type?.startsWith(`${typePrefix}:`)) continue;
      const cat = u.type.slice(typePrefix.length + 1);
      (map[cat] ||= []).push(u);
    }
    return map;
  }, [uploads, typePrefix]);

  async function uploadFiles(category: string, files: File[]) {
    if (isLocked || !files.length) return;
    setBusyCats((p) => ({ ...p, [category]: true }));
    try {
      const fd = new FormData();
      fd.append("caseId", caseId);
      fd.append("category", category);
      files.forEach((f) => fd.append("files[]", f));
      const res = await fetch(uploadApiUrl, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");
      if (json.saved?.length) setUploads((prev) => [...json.saved, ...prev]);
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "Upload failed");
    } finally {
      setBusyCats((p) => ({ ...p, [category]: false }));
    }
  }

  async function deleteUpload(uploadId: string) {
    if (isLocked) return;
    if (!confirm("Delete this photo?")) return;
    try {
      const res = await fetch(`/api/uploads/delete?uploadId=${encodeURIComponent(uploadId)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "Could not delete");
    }
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <section key={cat.key} className={`rounded-xl border p-4 space-y-3 ${isLocked ? "opacity-60" : ""}`}>
          <h2 className="font-semibold">
            {cat.title} {cat.required && <span className="text-xs text-amber-700">(required)</span>}
          </h2>
          {cat.help && <p className="text-sm text-gray-600">{cat.help}</p>}
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-sm ${
              isLocked ? "border-gray-300" : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={(e) => { if (!isLocked) e.preventDefault(); }}
            onDrop={(e) => {
              if (isLocked) return;
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
              uploadFiles(cat.key, files.slice(0, cat.maxFiles));
            }}
          >
            <div className="flex justify-between items-center">
              <span>{uploadsByCategory[cat.key]?.length ?? 0} uploaded</span>
              <label htmlFor={`category-upload-${cat.key}`} className={`px-3 py-2 rounded-md ${isLocked || busyCats[cat.key] ? "bg-gray-200 text-gray-500" : "bg-black text-white cursor-pointer"}`}>
                {isLocked ? "Locked" : busyCats[cat.key] ? "Uploading…" : "Choose files"}
                <input
                  id={`category-upload-${cat.key}`}
                  name={`uploads-${cat.key}`}
                  type="file"
                  className="hidden"
                  accept={cat.accept}
                  multiple
                  disabled={isLocked || !!busyCats[cat.key]}
                  onChange={(e) => uploadFiles(cat.key, Array.from(e.target.files ?? []))}
                />
              </label>
            </div>
          </div>
          {(uploadsByCategory[cat.key]?.length ?? 0) > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {uploadsByCategory[cat.key].slice(0, 6).map((u) => (
                <UploadedThumb key={u.id} upload={u} locked={isLocked} onDeleted={() => deleteUpload(u.id)} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
