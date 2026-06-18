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
import PatientImageEvidenceNudgeCallout from "@/components/patient/PatientImageEvidenceNudgeCallout";
import EvidenceUploadGuidancePanel from "@/components/patient/EvidenceUploadGuidancePanel";
import { computePatientImageEvidenceQualityFromCaseUploads } from "@/lib/audit/patientImageEvidenceConfidence";
import { buildPatientImageEvidenceUploadNudges } from "@/lib/audit/patientImageEvidenceUploadNudges";
import { isPatientImageEvidenceNudgesEnabled } from "@/lib/features/enablePatientImageEvidenceNudges";
import type { PatientPhotoUploadGuidancePanel } from "@/lib/patientPhoto/patientPhotoUploadGuidance";
import { evaluateEvidence, type CasePhotoInput } from "@/lib/evidence/evidenceEvaluator";
import { getUploadHighlightKeys } from "@/lib/evidence/evidenceUploadUiHints";
import { caseSubmitSurfaceOpen } from "@/lib/patient/caseSubmitStatus";
import PatientUploadRequirementsBanner from "@/components/patient/PatientUploadRequirementsBanner";
import {
  appendPatientUploadMetadata,
  formatPatientUploadError,
  PATIENT_UPLOAD_SAVE_LATER_MESSAGE,
  preparePatientUploadFile,
  computeRequiredUploadProgress,
} from "@/lib/uploads/patientUploadClient";

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
  patientPhotoStageGuidance,
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
  /** Intake-driven guidance + optional extended-group order (flagged server-side). */
  patientPhotoStageGuidance?: PatientPhotoUploadGuidancePanel | null;
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [busyCats, setBusyCats] = useState<Record<string, boolean>>({});
  const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({});
  const [categorySuccess, setCategorySuccess] = useState<Record<string, string>>({});
  const [qualityWarnings, setQualityWarnings] = useState<Record<string, string>>({});
  const [failedFilesByCategory, setFailedFilesByCategory] = useState<Record<string, File[]>>({});
  const [skippedOptional, setSkippedOptional] = useState<Set<string>>(new Set());

  const prefix = submitterType === "doctor" ? "doctor_photo" : "patient_photo";
  const schema = submitterType === "doctor" ? DOCTOR_PHOTO_SCHEMA : PATIENT_PHOTO_SCHEMA;
  const isLocked = !caseSubmitSurfaceOpen({ status: caseStatus, submitted_at: submittedAt });

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
  const requiredProgress =
    submitterType === "patient"
      ? computeRequiredUploadProgress(requiredKeys, completed)
      : null;

  const evidenceNudges = useMemo(() => {
    if (submitterType !== "patient" || !isPatientImageEvidenceNudgesEnabled()) return [];
    const q = computePatientImageEvidenceQualityFromCaseUploads(
      uploads.map((u) => ({ id: u.id, type: u.type, storage_path: u.storage_path }))
    );
    return buildPatientImageEvidenceUploadNudges(q);
  }, [submitterType, uploads]);

  const evidenceUi = useMemo(() => {
    const photos: CasePhotoInput[] = uploads.map((u) => ({
      type: u.type,
      metadata:
        u.metadata && typeof u.metadata === "object" && !Array.isArray(u.metadata)
          ? (u.metadata as { category?: string | null })
          : undefined,
    }));
    try {
      const result = evaluateEvidence(photos);
      return {
        result,
        highlightKeys: getUploadHighlightKeys(submitterType, result),
      };
    } catch {
      return null;
    }
  }, [uploads, submitterType]);

  async function uploadFiles(category: string, files: File[], isRetry = false) {
    if (isLocked || !files.length) return;

    setBusyCats((p) => ({ ...p, [category]: true }));
    setCategoryErrors((p) => {
      const next = { ...p };
      delete next[category];
      return next;
    });
    setCategorySuccess((p) => {
      const next = { ...p };
      delete next[category];
      return next;
    });

    const errors: string[] = [];
    const retryQueue: File[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const original = files[i];

        try {
          const { file, meta } = await preparePatientUploadFile(original);
          if (meta.qualityWarning) {
            setQualityWarnings((p) => ({ ...p, [category]: meta.qualityWarning! }));
          }

          const fd = new FormData();
          fd.append("caseId", caseId);
          fd.append("submitterType", submitterType);
          fd.append("category", category);
          fd.append("files[]", file);
          appendPatientUploadMetadata(fd, meta);

          const res = await fetch("/api/uploads/audit-photos", {
            method: "POST",
            body: fd,
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            const formatted = formatPatientUploadError(json);
            throw new Error(formatted.message);
          }

          if (json.saved?.length) {
            setUploads((prev) => [...json.saved, ...prev]);
          }
          successCount++;
        } catch (e: unknown) {
          const msg = (e as Error)?.message ?? "Upload failed";
          errors.push(`${original.name}: ${msg}`);
          retryQueue.push(original);
        }
      }

      if (successCount > 0) {
        setCategorySuccess((p) => ({
          ...p,
          [category]:
            successCount === 1
              ? "Photo saved successfully."
              : `${successCount} photos saved successfully.`,
        }));
        setFailedFilesByCategory((p) => {
          const next = { ...p };
          if (retryQueue.length === 0) delete next[category];
          else next[category] = retryQueue;
          return next;
        });
      }

      if (errors.length > 0) {
        setCategoryErrors((p) => ({
          ...p,
          [category]:
            successCount > 0
              ? `${successCount} saved, but ${errors.length} failed. Tap retry to try again.`
              : errors[0] ?? "Upload failed. Please try again.",
        }));
        if (retryQueue.length > 0) {
          setFailedFilesByCategory((p) => ({ ...p, [category]: retryQueue }));
        }
      } else if (isRetry) {
        setFailedFilesByCategory((p) => {
          const next = { ...p };
          delete next[category];
          return next;
        });
      }
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

        {submitterType === "patient" && (
          <>
            <div className="mt-4">
              <PatientUploadRequirementsBanner />
            </div>
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {PATIENT_UPLOAD_SAVE_LATER_MESSAGE}
            </p>
          </>
        )}

        {requiredProgress && requiredProgress.total > 0 ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Required photos progress</span>
              <span className="text-slate-600">
                {requiredProgress.completed} / {requiredProgress.total}
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={requiredProgress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-300"
                style={{ width: `${requiredProgress.percent}%` }}
              />
            </div>
            {canProceed ? (
              <p className="mt-2 text-sm font-medium text-emerald-700">
                All required photos uploaded — you can submit when ready.
              </p>
            ) : null}
          </div>
        ) : null}

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
              Missing required:{" "}
              {missingRequired
                .map((k) => schema.find((d) => d.key === k)?.title ?? k)
                .join(", ")}
              <span className="mt-0.5 block font-mono text-xs text-amber-800/90">
                {missingRequired.join(", ")}
              </span>
            </div>
          )}
        </div>

        {isLocked && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            Case submitted. Photos are locked.
          </div>
        )}

        {submitterType === "patient" && evidenceNudges.length > 0 ? (
          <div className="mt-4">
            <PatientImageEvidenceNudgeCallout nudges={evidenceNudges} />
          </div>
        ) : null}

        {evidenceUi ? (
          <div className="mt-4">
            <EvidenceUploadGuidancePanel result={evidenceUi.result} />
          </div>
        ) : null}

        {submitterType === "patient" && patientPhotoStageGuidance ? (
          <div
            className="mt-4 rounded-lg border border-sky-200 bg-sky-50/90 p-4 text-sm text-slate-800"
            role="note"
          >
            <p className="font-semibold text-slate-900">{patientPhotoStageGuidance.title}</p>
            <p className="mt-1 leading-relaxed text-slate-700">{patientPhotoStageGuidance.body}</p>
          </div>
        ) : null}
      </header>

      <div className="space-y-4">
        {schema.map((def) => {
          const hidden = def.required === false && skippedOptional.has(def.key);
          if (hidden) return null;

          return (
            <PhotoCategoryCard
              key={def.key}
              caseId={caseId}
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
              emphasize={evidenceUi?.highlightKeys.has(def.key) ?? false}
              showCantProvide={def.required === false && submitterType === "patient"}
              errorMessage={categoryErrors[def.key]}
              successMessage={categorySuccess[def.key]}
              qualityWarning={qualityWarnings[def.key]}
              failedFiles={failedFilesByCategory[def.key]}
              onRetry={() => {
                const failed = failedFilesByCategory[def.key];
                if (failed?.length) void uploadFiles(def.key, failed, true);
              }}
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
          extendedGroupOrderHint={patientPhotoStageGuidance?.extendedGroupOrderHint}
          highlightCategoryKeys={submitterType === "patient" ? evidenceUi?.highlightKeys : undefined}
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
  caseId,
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
  emphasize,
  showCantProvide,
  errorMessage,
  successMessage,
  qualityWarning,
  failedFiles,
  onRetry,
  onSkip,
  onUpload,
  onDeleted,
}: {
  caseId: string;
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
  emphasize?: boolean;
  showCantProvide: boolean;
  errorMessage?: string;
  successMessage?: string;
  qualityWarning?: string;
  failedFiles?: File[];
  onRetry?: () => void;
  onSkip: () => void;
  onUpload: (files: File[]) => void;
  onDeleted: (id: string) => void;
}) {
  const [drag, setDrag] = useState(false);
  const remaining = Math.max(0, max - existing.length);
  const disabled = locked || busy || remaining <= 0;
  const borderCls =
    emphasize && !locked
      ? "border-amber-400 ring-2 ring-amber-400/70 bg-amber-50/25"
      : errorMessage
        ? "border-rose-300 bg-rose-50/30"
        : successMessage
          ? "border-emerald-300 bg-emerald-50/20"
          : "border-slate-200";

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    onUpload(files.slice(0, remaining));
    e.target.value = "";
  };

  return (
    <section
      className={`rounded-xl border p-4 space-y-3 ${borderCls} ${locked ? "opacity-60" : ""}`}
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
        {existing.length >= min ? (
          <span className="ml-2 text-emerald-600 font-medium">✓ Complete</span>
        ) : null}
      </p>

      {qualityWarning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="note">
          Advisory: {qualityWarning} You can still upload — a clearer photo helps your audit.
        </p>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {errorMessage}
          {failedFiles && failedFiles.length > 0 && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={busy}
              className="mt-2 block rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-50"
            >
              Retry failed upload{failedFiles.length > 1 ? "s" : ""}
            </button>
          ) : null}
        </div>
      ) : null}

      {successMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {successMessage}
        </p>
      ) : null}

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
          onUpload(files.slice(0, remaining));
        }}
      >
        <div className="flex justify-between items-center">
          <span>{existing.length} uploaded</span>
          {!locked && remaining > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <label
                htmlFor={`audit-photo-camera-${category}`}
                className={`cursor-pointer rounded-md px-3 py-2 text-center text-xs font-semibold ${
                  disabled
                    ? "bg-gray-200 text-gray-500"
                    : "border border-cyan-200 bg-cyan-50 text-cyan-900 hover:bg-cyan-100"
                }`}
              >
                {busy ? "Uploading…" : "Take photo"}
                <input
                  id={`audit-photo-camera-${category}`}
                  type="file"
                  className="hidden"
                  accept={accept}
                  capture="environment"
                  disabled={disabled}
                  onChange={handleInput}
                />
              </label>
              <label
                htmlFor={`audit-photo-${category}`}
                className={`cursor-pointer rounded-md px-3 py-2 text-center text-xs font-semibold ${
                  disabled
                    ? "bg-gray-200 text-gray-500"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                Choose
                <input
                  id={`audit-photo-${category}`}
                  type="file"
                  className="hidden"
                  accept={accept}
                  multiple
                  disabled={disabled}
                  onChange={handleInput}
                />
              </label>
            </div>
          ) : (
            <span className="text-xs text-slate-500">{locked ? "Locked" : "Maximum reached"}</span>
          )}
        </div>
      </div>

      {existing.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {existing.slice(0, 6).map((u) => (
            <UploadedThumb
              key={u.id}
              upload={u}
              caseId={caseId}
              locked={locked}
              onDeleted={() => onDeleted(u.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
