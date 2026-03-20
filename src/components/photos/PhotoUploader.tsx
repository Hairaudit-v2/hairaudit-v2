"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  type SubmitterType,
  PATIENT_PHOTO_SCHEMA,
  DOCTOR_PHOTO_SCHEMA,
  getCompletedCategories,
  computeEvidenceScore,
  computeConfidenceLabel,
  getRequiredKeys,
  normalizeKeyForDisplay,
} from "@/lib/auditPhotoSchemas";
import {
  PATIENT_UPLOADER_REASSURANCE,
  PATIENT_UPLOADER_TIPS,
} from "@/lib/photoSchemas";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import ExtendedPatientPhotoUploadGroups from "@/components/patient/ExtendedPatientPhotoUploadGroups";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: unknown;
  created_at: string;
};

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

function categoryFromType(type: string, prefix: string): string | null {
  if (!type?.startsWith(`${prefix}:`)) return null;
  return type.slice(prefix.length + 1);
}

export default function PhotoUploader({
  caseId,
  submitterType,
  initialUploads,
  caseStatus,
  submittedAt,
  backHref,
  nextHref,
  nextLabel = "Continue",
  hideFooter,
}: {
  caseId: string;
  submitterType: SubmitterType;
  initialUploads: UploadRow[];
  caseStatus: string;
  submittedAt?: string | null;
  backHref: string;
  nextHref?: string;
  nextLabel?: string;
  hideFooter?: boolean;
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [busyCats, setBusyCats] = useState<Record<string, boolean>>({});
  const [skippedOptional, setSkippedOptional] = useState<Set<string>>(new Set());

  const prefix = submitterType === "doctor" ? "doctor_photo" : "patient_photo";
  const schema = submitterType === "doctor" ? DOCTOR_PHOTO_SCHEMA : PATIENT_PHOTO_SCHEMA;
  const isLocked = caseStatus === "submitted" || !!submittedAt;

  const uploadsByCategory = useMemo(() => {
    const map: Record<string, UploadRow[]> = {};
    for (const u of uploads) {
      const rawCat = categoryFromType(u.type, prefix);
      if (!rawCat) continue;
      const schemaKey = normalizeKeyForDisplay(rawCat, submitterType) ?? rawCat;
      (map[schemaKey] ||= []).push(u);
    }
    return map;
  }, [uploads, prefix, submitterType]);

  const photosForScoring = useMemo(
    () => uploads.map((u) => ({ type: u.type })),
    [uploads]
  );

  const completed = getCompletedCategories(submitterType, photosForScoring);
  const score = computeEvidenceScore(submitterType, photosForScoring);
  const confidence = computeConfidenceLabel(score);
  const requiredKeys = getRequiredKeys(submitterType);
  const missingRequired = requiredKeys.filter((k) => !completed.has(k));
  const canProceed = missingRequired.length === 0;

  async function uploadFiles(category: string, files: File[]) {
    if (isLocked || !files.length) return;

    setBusyCats((p) => ({ ...p, [category]: true }));
    try {
      const fd = new FormData();
      fd.append("caseId", caseId);
      fd.append("submitterType", submitterType);
      fd.append("category", category);
      files.forEach((f) => fd.append("files[]", f));

      const res = await fetch("/api/uploads/audit-photos", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      if (json.saved?.length) {
        setUploads((prev) => [...json.saved, ...prev]);
      }
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
      const res = await fetch(
        `/api/uploads/delete?uploadId=${encodeURIComponent(uploadId)}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "Could not delete");
    }
  }

  const toggleSkipped = (key: string) => {
    if (schema.find((c) => c.key === key)?.required) return;
    setSkippedOptional((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-semibold">
          {submitterType === "doctor" ? "Doctor" : "Patient"} Photo Uploads
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {submitterType === "doctor"
            ? "Upload the required standardized photo set for best audit quality."
            : "Upload at least the 3 required current photos. Extra photos improve your evidence score."}
        </p>

        <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <span className="text-sm font-medium text-slate-600">Evidence Score:</span>{" "}
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 text-sm font-bold ${
                score === "A"
                  ? "bg-green-100 text-green-800"
                  : score === "B"
                    ? "bg-blue-100 text-blue-800"
                    : score === "C"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
              }`}
            >
              {score}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-600">Confidence:</span>{" "}
            <span className="text-sm font-medium">{confidence}</span>
          </div>
          {missingRequired.length > 0 && (
            <div className="text-sm text-amber-700">
              Missing required: {missingRequired.join(", ")}
            </div>
          )}
        </div>

        {isLocked && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            Case submitted. Photos are locked.
          </div>
        )}
      </header>

      <div className="space-y-4">
        {schema.map((def) => {
          const hidden = def.required === false && skippedOptional.has(def.key);
          if (hidden) return null;

          return (
            <PhotoCategoryCard
              key={def.key}
              category={def.key}
              title={def.title}
              help={def.help}
              quickTips={def.quickTips}
              required={def.required}
              min={def.min}
              max={def.max}
              accept={def.accept ?? "image/*"}
              existing={uploadsByCategory[def.key] ?? []}
              busy={!!busyCats[def.key]}
              locked={isLocked}
              showCantProvide={def.required === false && submitterType === "patient"}
              onSkip={() => toggleSkipped(def.key)}
              onUpload={(files) => uploadFiles(def.key, files)}
              onDeleted={deleteUpload}
            />
          );
        })}
      </div>

      {submitterType === "patient" && (
        <ExtendedPatientPhotoUploadGroups
          locked={isLocked}
          busyCats={busyCats}
          uploadsByCategory={uploadsByCategory}
          onUpload={(cat, files) => {
            void uploadFiles(cat, files);
          }}
          onDeleted={deleteUpload}
          skin="audit"
        />
      )}

      {submitterType === "patient" && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {PATIENT_UPLOADER_REASSURANCE}
        </p>
      )}

      {submitterType === "patient" && (
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer p-4 font-medium text-slate-900 hover:bg-slate-50">
            {PATIENT_UPLOADER_TIPS.title}
          </summary>
          <ul className="list-disc space-y-1 px-4 pb-4 pl-8 text-sm text-slate-600">
            {PATIENT_UPLOADER_TIPS.bullets.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Review Summary</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {schema.map((def) => {
            const count = uploadsByCategory[def.key]?.length ?? 0;
            const ok = count >= def.min;
            return (
              <li key={def.key} className="flex justify-between">
                <span>{def.title}</span>
                <span className={ok ? "text-green-600" : "text-amber-600"}>
                  {count} / {def.min} min {ok ? "✓" : ""}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-slate-500">
          Evidence: {score} — {confidence}
        </p>
      </div>

      {!hideFooter && (
      <footer className="flex items-center justify-between border-t pt-4">
        <Link href={backHref} className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back
        </Link>
        {nextHref ? (
          canProceed && !isLocked ? (
            <Link
              href={nextHref}
              className="rounded-md px-4 py-2 font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              {nextLabel}
            </Link>
          ) : (
            <span className="rounded-md px-4 py-2 font-medium cursor-not-allowed bg-gray-200 text-gray-500">
              {nextLabel}
            </span>
          )
        ) : (
          canProceed && !isLocked ? (
            <Link
              href={`/cases/${caseId}`}
              className="rounded-md px-4 py-2 font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              Submit for audit
            </Link>
          ) : (
            <span className="rounded-md px-4 py-2 font-medium cursor-not-allowed bg-gray-200 text-gray-500">
              Complete required photos first
            </span>
          )
        )}
      </footer>
      )}
    </div>
  );
}

function PhotoCategoryCard({
  category,
  title,
  help,
  quickTips,
  required,
  min,
  max,
  accept,
  existing,
  busy,
  locked,
  showCantProvide,
  onSkip,
  onUpload,
  onDeleted,
}: {
  category: string;
  title: string;
  help?: string;
  quickTips?: readonly string[];
  required: boolean;
  min: number;
  max: number;
  accept: string;
  existing: UploadRow[];
  busy: boolean;
  locked: boolean;
  showCantProvide: boolean;
  onSkip: () => void;
  onUpload: (files: File[]) => void;
  onDeleted: (id: string) => void;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <section
      className={`rounded-xl border p-4 space-y-3 ${locked ? "opacity-60" : ""}`}
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
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            I can&apos;t provide this
          </button>
        )}
      </div>

      {help && (
        <p className="text-sm text-slate-600">{help}</p>
      )}

      {quickTips && quickTips.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {quickTips.map((t) => (
            <li key={t} className="flex items-center gap-1">
              <span className="text-amber-500">•</span> {t}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-slate-600">
        {existing.length} / {max} max • min {min}
      </p>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-sm ${
          drag ? "border-slate-600 bg-slate-50" : "border-slate-300"
        }`}
        onDragOver={(e) => {
          if (!locked) {
            e.preventDefault();
            setDrag(true);
          }
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (locked) return;
          e.preventDefault();
          setDrag(false);
          const files = Array.from(e.dataTransfer.files).filter((f) => acceptsFile(f, accept));
          onUpload(files.slice(0, max - existing.length));
        }}
      >
        <div className="flex justify-between items-center">
          <span>{existing.length} uploaded</span>
          <label
            htmlFor={`audit-photo-${category}`}
            className={`cursor-pointer rounded-md px-3 py-2 ${
              locked || busy
                ? "bg-gray-200 text-gray-500"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {locked ? "Locked" : busy ? "Uploading…" : "Choose files"}
            <input
              id={`audit-photo-${category}`}
              type="file"
              className="hidden"
              accept={accept}
              multiple
              disabled={locked || busy}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                onUpload(files.slice(0, max - existing.length));
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {existing.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {existing.slice(0, 6).map((u) => (
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
