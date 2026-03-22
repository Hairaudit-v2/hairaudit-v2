"use client";

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { PATIENT_PHOTO_CATEGORIES, type PatientPhotoCategory } from "@/lib/photoCategories";
import { UPLOAD_LIMITS, UploadQueue, formatUploadErrorForUser } from "@/lib/uploads/safeUpload";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import ExtendedPatientPhotoUploadGroups from "./ExtendedPatientPhotoUploadGroups";
import { isPatientImageEvidenceNudgesEnabled } from "@/lib/features/enablePatientImageEvidenceNudges";
import { computePatientImageEvidenceQualityFromCaseUploads } from "@/lib/audit/patientImageEvidenceConfidence";
import { buildPatientImageEvidenceUploadNudges } from "@/lib/audit/patientImageEvidenceUploadNudges";
import PatientImageEvidenceNudgeCallout from "./PatientImageEvidenceNudgeCallout";
import type { PatientPhotoUploadGuidancePanel } from "@/lib/patientPhoto/patientPhotoUploadGuidance";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: unknown;
  created_at: string;
};

type UploadStatus =
  | { status: "idle" }
  | { status: "uploading"; category: string; progress: number }
  | { status: "success"; category: string }
  | { status: "error"; category: string; message: string };

export type UnifiedPatientUploaderProps = {
  caseId: string;
  initialUploads: UploadRow[];
  caseStatus: string;
  submittedAt?: string | null;
  patientPhotoStageGuidance?: PatientPhotoUploadGuidancePanel | null;
  backHref?: string;
  nextHref?: string;
  uploadApiUrl?: string; // Defaults to /api/uploads/patient-photos
};

const uploadQueue = new UploadQueue(UPLOAD_LIMITS.MAX_CONCURRENT_UPLOADS);

function acceptsFile(file: File, accept: string): boolean {
  if (!accept || accept === "*/*") return true;
  const mime = file.type?.toLowerCase() ?? "";
  const dotExt = `.${(file.name.split(".").pop() ?? "").toLowerCase()}`;
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return tokens.some((token) => {
    if (token === "*/*") return true;
    if (token.endsWith("/*")) return mime.startsWith(token.slice(0, -1));
    if (token.startsWith(".")) return dotExt === token;
    return mime === token;
  });
}

function categoryFromType(type: string): PatientPhotoCategory | null {
  const prefix = "patient_photo:";
  if (!type?.startsWith(prefix)) return null;
  return type.slice(prefix.length) as PatientPhotoCategory;
}

export default function UnifiedPatientUploader({
  caseId,
  initialUploads,
  caseStatus,
  submittedAt,
  patientPhotoStageGuidance,
  backHref = `/cases/${caseId}/patient/questions`,
  nextHref = `/cases/${caseId}`,
  uploadApiUrl = "/api/uploads/patient-photos",
}: UnifiedPatientUploaderProps) {
  const [uploads, setUploads] = useState<UploadRow[]>(initialUploads);
  const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>({});
  const [skippedOptional, setSkippedOptional] = useState<Set<string>>(new Set());
  const [globalError, setGlobalError] = useState<string | null>(null);

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
    return PATIENT_PHOTO_CATEGORIES.filter((c) => c.required).every(
      (c) => (uploadsByCategory[c.key]?.length ?? 0) > 0
    );
  }, [uploadsByCategory]);

  const evidenceNudges = useMemo(() => {
    if (!isPatientImageEvidenceNudgesEnabled()) return [];
    const q = computePatientImageEvidenceQualityFromCaseUploads(
      uploads.map((u) => ({ id: u.id, type: u.type, storage_path: u.storage_path }))
    );
    return buildPatientImageEvidenceUploadNudges(q);
  }, [uploads]);

  const uploadFiles = useCallback(
    async (category: PatientPhotoCategory, files: File[]) => {
      if (isLocked || !files.length) return;

      setGlobalError(null);
      const totalFiles = files.length;
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      setUploadStatus((prev) => ({
        ...prev,
        [category]: { status: "uploading", category, progress: 0 },
      }));

      // Upload files sequentially to stay under Vercel 4.5MB limit
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          await uploadQueue.execute(async () => {
            const fd = new FormData();
            fd.append("caseId", caseId);
            fd.append("category", category);
            fd.append("files[]", file);

            const res = await fetch(uploadApiUrl, {
              method: "POST",
              body: fd,
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
              const errorMsg = json?.error ?? "Upload failed";
              console.error(`Upload failed for ${category}/${file.name}:`, { error: errorMsg, code: json?.code, requestId: json?.requestId });
              throw new Error(formatUploadErrorForUser({ code: json?.code ?? "UNKNOWN_ERROR", message: errorMsg, retryable: false }));
            }

            // Success - add new uploads to state
            if (json.saved?.length) {
              setUploads((prev) => [...json.saved, ...prev]);
            }

            successCount++;
            
            // Update progress
            setUploadStatus((prev) => ({
              ...prev,
              [category]: { 
                status: "uploading", 
                category, 
                progress: Math.round(((i + 1) / totalFiles) * 100) 
              },
            }));
          });
        } catch (e: unknown) {
          errorCount++;
          const msg = (e as Error)?.message ?? "Upload failed";
          errors.push(`${file.name}: ${msg}`);
        }
      }

      // Final status update
      if (errorCount === 0) {
        setUploadStatus((prev) => ({
          ...prev,
          [category]: { status: "success", category },
        }));
      } else if (successCount === 0) {
        setUploadStatus((prev) => ({
          ...prev,
          [category]: { 
            status: "error", 
            category, 
            message: errors[0] ?? "All uploads failed" 
          },
        }));
      } else {
        // Partial success
        setUploadStatus((prev) => ({
          ...prev,
          [category]: { 
            status: "success", 
            category,
          },
        }));
        console.warn(`Partial upload success for ${category}:`, errors);
      }

      // Clear success status after delay
      setTimeout(() => {
        setUploadStatus((prev) => {
          if (prev[category]?.status === "success" || prev[category]?.status === "error") {
            const { [category]: _, ...rest } = prev;
            return rest;
          }
          return prev;
        });
      }, 3000);
    },
    [caseId, isLocked, uploadApiUrl]
  );

  const deleteUpload = useCallback(
    async (uploadId: string) => {
      if (isLocked) return;
      if (!confirm("Delete this photo?")) return;

      try {
        const res = await fetch(`/api/uploads/delete?uploadId=${encodeURIComponent(uploadId)}`, {
          method: "DELETE",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Delete failed");
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      } catch (e: unknown) {
        alert((e as Error)?.message ?? "Could not delete");
      }
    },
    [isLocked]
  );

  const toggleSkipped = (key: string) => {
    const cat = PATIENT_PHOTO_CATEGORIES.find((c) => c.key === key);
    if (cat?.required) return;

    setSkippedOptional((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const completedCount = useMemo(
    () => PATIENT_PHOTO_CATEGORIES.filter((c) => c.required && (uploadsByCategory[c.key]?.length ?? 0) > 0).length,
    [uploadsByCategory]
  );

  const totalRequired = useMemo(
    () => PATIENT_PHOTO_CATEGORIES.filter((c) => c.required).length,
    []
  );

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

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm">
            <span className="font-medium text-slate-700">Progress: </span>
            <span className="font-semibold text-slate-900">{completedCount}</span>
            <span className="text-slate-600"> / {totalRequired} required categories</span>
          </div>
        </div>

        {globalError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {globalError}
          </div>
        )}
      </header>

      {evidenceNudges.length > 0 && <PatientImageEvidenceNudgeCallout nudges={evidenceNudges} />}

      {patientPhotoStageGuidance && (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50/90 p-4 text-sm text-gray-900"
          role="note"
        >
          <p className="font-semibold">{patientPhotoStageGuidance.title}</p>
          <p className="mt-1 leading-relaxed text-gray-700">{patientPhotoStageGuidance.body}</p>
        </div>
      )}

      <div className="space-y-4">
        {PATIENT_PHOTO_CATEGORIES.map((cat) => {
          const hidden = !cat.required && skippedOptional.has(cat.key);
          if (hidden) return null;

          return (
            <PhotoCategoryCard
              key={cat.key}
              category={cat.key}
              title={cat.title}
              help={cat.help}
              tips={cat.tips}
              required={cat.required}
              maxFiles={cat.maxFiles}
              accept={cat.accept}
              existing={uploadsByCategory[cat.key] ?? []}
              status={uploadStatus[cat.key]}
              locked={isLocked}
              showCantProvide={!cat.required}
              onSkip={() => toggleSkipped(cat.key)}
              onUpload={(files) => uploadFiles(cat.key, files)}
              onDeleted={deleteUpload}
            />
          );
        })}
      </div>

      <ExtendedPatientPhotoUploadGroups
        locked={isLocked}
        busyCats={Object.fromEntries(
          Object.entries(uploadStatus)
            .filter(([, s]) => s.status === "uploading")
            .map(([k]) => [k, true])
        )}
        uploadsByCategory={uploadsByCategory}
        onUpload={uploadFiles}
        onDeleted={deleteUpload}
        skin="audit"
        extendedGroupOrderHint={patientPhotoStageGuidance?.extendedGroupOrderHint}
      />

      <footer className="flex items-center justify-between pt-3 border-t text-sm">
        <Link href={backHref} className="text-gray-600 hover:text-gray-900">
          ← Back
        </Link>

        <div className="flex items-center gap-3">
          {requiredOk && !isLocked ? (
            <Link
              href={nextHref}
              className="rounded-md px-4 py-2 font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              Submit for audit →
            </Link>
          ) : (
            <span className="rounded-md px-4 py-2 font-medium cursor-not-allowed bg-gray-200 text-gray-500">
              Complete required photos first
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

function PhotoCategoryCard({
  category,
  title,
  help,
  tips,
  required,
  maxFiles,
  accept,
  existing,
  status,
  locked,
  showCantProvide,
  onSkip,
  onUpload,
  onDeleted,
}: {
  category: string;
  title: string;
  help?: string;
  tips?: readonly string[];
  required: boolean;
  maxFiles: number;
  accept: string;
  existing: UploadRow[];
  status?: UploadStatus;
  locked: boolean;
  showCantProvide: boolean;
  onSkip: () => void;
  onUpload: (files: File[]) => void;
  onDeleted: (id: string) => void;
}) {
  const [drag, setDrag] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const remaining = Math.max(0, maxFiles - existing.length);
  const isUploading = status?.status === "uploading";
  const isError = status?.status === "error";
  const isSuccess = status?.status === "success";

  const handleDragOver = (e: React.DragEvent) => {
    if (!locked && remaining > 0) {
      e.preventDefault();
      setDrag(true);
    }
  };

  const handleDragLeave = () => setDrag(false);

  const handleDrop = (e: React.DragEvent) => {
    if (locked || remaining <= 0) return;
    e.preventDefault();
    setDrag(false);

    const files = Array.from(e.dataTransfer.files).filter((f) => acceptsFile(f, accept));
    const toUpload = files.slice(0, remaining);

    if (toUpload.length > 0) {
      onUpload(toUpload);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => acceptsFile(f, accept));
    const toUpload = files.slice(0, remaining);

    if (toUpload.length > 0) {
      onUpload(toUpload);
    }

    // Reset input
    e.target.value = "";
  };

  return (
    <section
      className={`rounded-xl border p-4 space-y-3 ${locked ? "opacity-60" : ""} ${
        isError ? "border-red-300 bg-red-50/30" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          {title}{" "}
          {required && <span className="text-xs text-amber-700">(required)</span>}
        </h2>
        {showCantProvide && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            I can&apos;t provide this
          </button>
        )}
      </div>

      {help && <p className="text-sm text-slate-600">{help}</p>}

      {tips && tips.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {tips.map((t) => (
            <li key={t} className="flex items-center gap-1">
              <span className="text-amber-500">•</span> {t}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-slate-600">
        {existing.length} uploaded
        {remaining > 0 ? ` • ${remaining} more allowed` : " • maximum reached"}
      </p>

      {isError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {status?.status === "error" && status.message}
        </div>
      )}

      {isSuccess && (
        <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2">
          Upload complete ✓
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-sm transition-colors ${
          drag
            ? "border-slate-600 bg-slate-50"
            : isHovering
            ? "border-slate-400 bg-slate-50/50"
            : "border-slate-300"
        } ${remaining <= 0 || locked ? "bg-gray-50 cursor-not-allowed" : "cursor-pointer"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="flex justify-between items-center">
          <span className={remaining <= 0 ? "text-gray-400" : ""}>
            {locked
              ? "Locked"
              : remaining <= 0
              ? "Maximum files reached"
              : isUploading
              ? "Uploading..."
              : "Drop images here or click to choose"}
          </span>

          <label
            htmlFor={`unified-upload-${category}`}
            className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              locked || remaining <= 0 || isUploading
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {isUploading ? "Uploading..." : locked ? "Locked" : "Choose files"}
            <input
              id={`unified-upload-${category}`}
              type="file"
              className="hidden"
              accept={accept}
              multiple
              disabled={locked || remaining <= 0 || isUploading}
              onChange={handleFileInput}
            />
          </label>
        </div>
      </div>

      {existing.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {existing.slice(0, 12).map((u) => (
            <UploadedThumb
              key={u.id}
              upload={u}
              locked={locked}
              onDeleted={() => onDeleted(u.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
