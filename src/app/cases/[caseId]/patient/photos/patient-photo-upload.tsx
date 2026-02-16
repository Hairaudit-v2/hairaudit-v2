"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  PATIENT_PHOTO_CATEGORIES,
  PatientPhotoCategory,
} from "@/lib/photoCategories";
import UploadedThumb from "@/components/uploads/UploadedThumb";

/* ---------------- Types ---------------- */

type UploadRow = {
  id: string;
  type: string; // "patient_photo:preop_front"
  storage_path: string;
  metadata: any;
  created_at: string;
};

/* ---------------- Helpers ---------------- */

function categoryFromType(type: string): PatientPhotoCategory | null {
  const prefix = "patient_photo:";
  if (!type?.startsWith(prefix)) return null;
  return type.slice(prefix.length) as PatientPhotoCategory;
}

/* ---------------- Main ---------------- */

export default function PatientPhotoUpload({
  caseId,
  initialUploads,
  caseStatus,
  submittedAt,
}: {
  caseId: string;
  initialUploads: UploadRow[];
  caseStatus: string;
  submittedAt?: string | null;
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [busyCats, setBusyCats] = useState<Record<string, boolean>>({});

  const isLocked = caseStatus === "submitted" || !!submittedAt;

  const uploadsByCategory = useMemo(() => {
    const map: Record<string, UploadRow[]> = {};
    for (const u of uploads) {
      const cat = categoryFromType(u.type);
      if (!cat) continue;
      (map[cat] ||= []).push(u);
    }
    return map;
  }, [uploads]);

  const requiredOk = useMemo(() => {
    return PATIENT_PHOTO_CATEGORIES
      .filter((c) => c.required)
      .every((c) => (uploadsByCategory[c.key]?.length ?? 0) > 0);
  }, [uploadsByCategory]);

  async function uploadFiles(category: PatientPhotoCategory, files: File[]) {
    if (isLocked || !files.length) return;

    setBusyCats((p) => ({ ...p, [category]: true }));
    try {
      const fd = new FormData();
      fd.append("caseId", caseId);
      fd.append("category", category);
      files.forEach((f) => fd.append("files[]", f));

      const res = await fetch("/api/uploads/patient-photos", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      if (json.saved?.length) {
        setUploads((prev) => [...json.saved, ...prev]);
      }
    } catch (e: any) {
      alert(e?.message ?? "Upload failed");
    } finally {
      setBusyCats((p) => ({ ...p, [category]: false }));
    }
  }

  async function deleteUpload(uploadId: string) {
    if (isLocked) return;
    if (!confirm("Delete this photo?")) return;

    try {
      const res = await fetch(
        `/api/uploads/delete?uploadId=${encodeURIComponent(uploadId)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
    } catch (e: any) {
      alert(e?.message ?? "Could not delete photo");
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Upload Patient Photos</h1>
        <p className="text-sm text-gray-600">
          Clear photos help validate donor quality, graft placement, and likely growth.
        </p>

        {isLocked && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <b>Case submitted.</b> Photos are locked to preserve audit integrity.
          </div>
        )}
      </header>

      <div className="space-y-4">
        {PATIENT_PHOTO_CATEGORIES.map((cat) => (
          <PhotoCategoryCard
            key={cat.key}
            category={cat.key}
            title={cat.title}
            required={cat.required}
            help={cat.help}
            tips={cat.tips}
            existing={uploadsByCategory[cat.key] ?? []}
            maxFiles={cat.maxFiles}
            accept={cat.accept}
            busy={!!busyCats[cat.key]}
            locked={isLocked}
            onUpload={(files) => uploadFiles(cat.key, files)}
            onDeleted={deleteUpload}
          />
        ))}
      </div>

      <footer className="flex items-center justify-between pt-3 border-t text-sm">
        <span>
          {isLocked
            ? "Case submitted — photos locked"
            : requiredOk
            ? "Required photos complete ✅"
            : "Upload required categories to continue"}
        </span>

        <div className="flex items-center gap-3">
          <Link
            href={`/cases/${caseId}/patient/questions`}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to questions
          </Link>
          <Link
            href={`/cases/${caseId}`}
            className={`rounded-md px-4 py-2 font-medium ${
              requiredOk && !isLocked
                ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                : "bg-gray-200 text-gray-500 pointer-events-none"
            }`}
          >
            3. Submit for audit
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- Category Card ---------------- */

function PhotoCategoryCard(props: {
  category: string;
  title: string;
  required: boolean;
  help: string;
  tips: readonly string[];
  existing: UploadRow[];
  maxFiles: number;
  accept: string;
  busy: boolean;
  locked: boolean;
  onUpload: (files: File[]) => void;
  onDeleted: (uploadId: string) => void;
}) {
  const [drag, setDrag] = useState(false);

  return (
    <section className={`rounded-xl border p-4 space-y-3 ${props.locked ? "opacity-60" : ""}`}>
      <h2 className="font-semibold">
        {props.title}{" "}
        {props.required && <span className="text-xs text-amber-700">(required)</span>}
      </h2>

      <p className="text-sm text-gray-600">{props.help}</p>

      <ul className="list-disc pl-5 text-sm text-gray-600">
        {props.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-sm ${
          drag ? "border-black bg-gray-50" : "border-gray-300"
        }`}
        onDragOver={(e) => {
          if (props.locked) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (props.locked) return;
          e.preventDefault();
          setDrag(false);
          const files = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith("image/")
          );
          props.onUpload(files.slice(0, props.maxFiles));
        }}
      >
        <div className="flex justify-between items-center">
          <span>{props.existing.length} uploaded</span>

          <label
            htmlFor={`patient-photo-upload-${props.category}`}
            className={`px-3 py-2 rounded-md ${
              props.locked || props.busy
                ? "bg-gray-200 text-gray-500"
                : "bg-black text-white cursor-pointer"
            }`}
          >
            {props.locked ? "Locked" : props.busy ? "Uploading…" : "Choose files"}
            <input
              id={`patient-photo-upload-${props.category}`}
              name="patientPhotos"
              type="file"
              className="hidden"
              accept={props.accept}
              multiple
              disabled={props.locked || props.busy}
              onChange={(e) =>
                props.onUpload(Array.from(e.target.files ?? []))
              }
            />
          </label>
        </div>
      </div>

      {props.existing.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {props.existing.slice(0, 6).map((u) => (
            <UploadedThumb
              key={u.id}
              upload={u}
              locked={props.locked}
              onDeleted={() => props.onDeleted(u.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
