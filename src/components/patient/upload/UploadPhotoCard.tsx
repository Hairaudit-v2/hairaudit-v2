"use client";

import React, { useState } from "react";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import DeletePhotoConfirm from "@/components/patient/upload/DeletePhotoConfirm";
import UploadProgressBar from "@/components/patient/upload/UploadProgressBar";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { formatTemplate } from "@/lib/i18n/formatTemplate";
import type { PerFileUploadState } from "@/lib/uploads/uploadPatientPhotos";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: unknown;
  created_at: string;
};

export type PhotoSlotStatus =
  | "required"
  | "recommended"
  | "optional"
  | "uploading"
  | "complete"
  | "needs_retry";

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

function statusBadge(
  status: PhotoSlotStatus,
  labels: Record<PhotoSlotStatus, string>
): { label: string; className: string } {
  switch (status) {
    case "required":
      return { label: labels.required, className: "bg-amber-100 text-amber-900" };
    case "recommended":
      return { label: labels.recommended, className: "bg-sky-100 text-sky-900" };
    case "optional":
      return { label: labels.optional, className: "bg-slate-100 text-slate-600" };
    case "uploading":
      return { label: labels.uploading, className: "bg-cyan-100 text-cyan-900" };
    case "complete":
      return { label: labels.complete, className: "bg-emerald-100 text-emerald-800" };
    case "needs_retry":
      return { label: labels.needs_retry, className: "bg-rose-100 text-rose-800" };
  }
}

export default function UploadPhotoCard({
  caseId,
  category,
  title,
  help,
  quickTips,
  slotStatus,
  min,
  max,
  accept,
  existing,
  locked,
  emphasize,
  showCantProvide,
  errorMessage,
  successMessage,
  qualityWarning,
  partialErrors,
  fileUploadStates,
  failedFiles,
  onRetry,
  onRetryFile,
  onSkip,
  onUpload,
  onDeleted,
  onDeleteError,
  compact = false,
  patientCopy = false,
}: {
  caseId: string;
  category: string;
  title: string;
  help?: string;
  quickTips?: readonly string[];
  slotStatus: PhotoSlotStatus;
  min: number;
  max: number;
  accept: string;
  existing: UploadRow[];
  locked: boolean;
  emphasize?: boolean;
  showCantProvide?: boolean;
  errorMessage?: string;
  successMessage?: string;
  qualityWarning?: string;
  partialErrors?: Array<{ file: string; error: string }>;
  fileUploadStates?: PerFileUploadState[];
  failedFiles?: File[];
  onRetry?: () => void;
  onRetryFile?: (file: File) => void;
  onSkip?: () => void;
  onUpload: (files: File[]) => void;
  onDeleted: (id: string) => void;
  onDeleteError?: (message: string) => void;
  compact?: boolean;
  /** When true, use calm patient-facing i18n copy for buttons and status labels. */
  patientCopy?: boolean;
}) {
  const { t } = useI18n();
  const [drag, setDrag] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const busy = slotStatus === "uploading";
  const remaining = Math.max(0, max - existing.length);
  const disabled = locked || busy || remaining <= 0;

  const copy = patientCopy
    ? {
        badgeRequired: t("patient.upload.card.badgeRequired" as TranslationKey),
        badgeRecommended: t("patient.upload.card.badgeRecommended" as TranslationKey),
        badgeOptional: t("patient.upload.card.badgeOptional" as TranslationKey),
        badgeUploading: t("patient.upload.card.badgeUploading" as TranslationKey),
        badgeComplete: t("patient.upload.card.badgeComplete" as TranslationKey),
        badgeNeedsRetry: t("patient.upload.card.badgeNeedsRetry" as TranslationKey),
        choosePhoto: t("patient.upload.card.choosePhoto" as TranslationKey),
        takePhoto: t("patient.upload.card.takePhoto" as TranslationKey),
        tryAgain: t("patient.upload.card.tryAgain" as TranslationKey),
        retryFailedUploads: t("patient.upload.card.retryFailedUploads" as TranslationKey),
        dragHint: t("patient.upload.card.dragHint" as TranslationKey),
        dropHint: t("patient.upload.card.dropHint" as TranslationKey),
        qualityAdvisoryPrefix: t("patient.upload.card.qualityAdvisoryPrefix" as TranslationKey),
        qualityAdvisorySuffix: t("patient.upload.card.qualityAdvisorySuffix" as TranslationKey),
        partialUploadError: t("patient.upload.card.partialUploadError" as TranslationKey),
        preparing: t("patient.upload.card.preparing" as TranslationKey),
        uploading: t("patient.upload.card.uploading" as TranslationKey),
        done: t("patient.upload.card.done" as TranslationKey),
        failed: t("patient.upload.card.failed" as TranslationKey),
        cantProvide: t("patient.upload.card.cantProvide" as TranslationKey),
        locked: t("patient.upload.card.locked" as TranslationKey),
        maxReached: t("patient.upload.card.maxReached" as TranslationKey),
        deleteFailed: t("patient.upload.messages.deleteFailed" as TranslationKey),
      }
    : {
        badgeRequired: "Required",
        badgeRecommended: "Recommended",
        badgeOptional: "Optional",
        badgeUploading: "Uploading",
        badgeComplete: "Complete",
        badgeNeedsRetry: "Needs retry",
        choosePhoto: "Choose files",
        takePhoto: "Take photo",
        tryAgain: "Retry",
        retryFailedUploads: "Retry failed upload",
        dragHint: "Drag photos here",
        dropHint: "Drop to upload",
        qualityAdvisoryPrefix: "Advisory:",
        qualityAdvisorySuffix: "You can still upload — a clearer photo helps your review.",
        partialUploadError: "Some files could not be uploaded:",
        preparing: "Preparing…",
        uploading: "Uploading…",
        done: "Done",
        failed: "Failed",
        cantProvide: "I can't provide this",
        locked: "Locked",
        maxReached: "Maximum reached",
        deleteFailed: "Could not delete photo",
      };

  const badgeLabels: Record<PhotoSlotStatus, string> = {
    required: copy.badgeRequired,
    recommended: copy.badgeRecommended,
    optional: copy.badgeOptional,
    uploading: copy.badgeUploading,
    complete: copy.badgeComplete,
    needs_retry: copy.badgeNeedsRetry,
  };
  const badge = statusBadge(slotStatus, badgeLabels);

  const minMaxHint = patientCopy
    ? formatTemplate(t("patient.upload.card.minMaxHint" as TranslationKey), {
        current: String(existing.length),
        max: String(max),
        min: String(min),
      })
    : `${existing.length} / ${max} max • min ${min}`;

  const uploadedLine = patientCopy
    ? `${formatTemplate(t("patient.upload.card.uploadedCount" as TranslationKey), {
        count: String(existing.length),
      })}${remaining > 0 ? ` • ${formatTemplate(t("patient.upload.card.moreAllowed" as TranslationKey), { count: String(remaining) })}` : ""}`
    : `${existing.length} uploaded${remaining > 0 ? ` • ${remaining} more allowed` : ""}`;

  const borderCls =
    emphasize && !locked
      ? "border-amber-400 ring-2 ring-amber-400/70 bg-amber-50/25"
      : slotStatus === "needs_retry" || errorMessage
        ? "border-rose-300 bg-rose-50/30"
        : slotStatus === "complete" || successMessage
          ? "border-emerald-300 bg-emerald-50/20"
          : "border-slate-200";

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    onUpload(files.slice(0, remaining));
    e.target.value = "";
  };

  async function confirmDelete() {
    if (!pendingDeleteId || locked) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(
        `/api/uploads/delete?uploadId=${encodeURIComponent(pendingDeleteId)}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      onDeleted(pendingDeleteId);
      setPendingDeleteId(null);
    } catch (e: unknown) {
      onDeleteError?.((e as Error)?.message ?? copy.deleteFailed);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <section
      className={`rounded-xl border p-4 space-y-3 ${borderCls} ${locked ? "opacity-60" : ""} ${compact ? "p-3 space-y-2" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={`font-semibold ${compact ? "text-sm" : ""}`}>{title}</h2>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
        {showCantProvide && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            {copy.cantProvide}
          </button>
        ) : null}
      </div>

      {help ? <p className={`text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>{help}</p> : null}

      {quickTips && quickTips.length > 0 ? (
        <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-slate-500 ${compact ? "text-[11px]" : "text-xs"}`}>
          {quickTips.map((t) => (
            <li key={t} className="flex items-center gap-1">
              <span className="text-amber-500">•</span> {t}
            </li>
          ))}
        </ul>
      ) : null}

      <p className={`text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>{minMaxHint}</p>

      {qualityWarning ? (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="note"
        >
          {copy.qualityAdvisoryPrefix} {qualityWarning} {copy.qualityAdvisorySuffix}
        </p>
      ) : null}

      {fileUploadStates && fileUploadStates.length > 0 ? (
        <ul className="space-y-2" aria-label="Upload progress">
          {fileUploadStates.map((s) => (
            <li key={s.id} className="rounded-md border border-slate-200 bg-white/80 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-slate-700">{s.fileName}</span>
                <span className="shrink-0 text-slate-500">
                  {s.phase === "compressing"
                    ? copy.preparing
                    : s.phase === "uploading"
                      ? copy.uploading
                      : s.phase === "complete"
                        ? copy.done
                        : copy.failed}
                </span>
              </div>
              {s.phase === "failed" ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-rose-700">{s.error ?? copy.failed}</p>
                  {onRetryFile && failedFiles?.some((f) => `${f.name}:${f.size}:${f.lastModified}` === s.id) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const file = failedFiles?.find(
                          (f) => `${f.name}:${f.size}:${f.lastModified}` === s.id
                        );
                        if (file) onRetryFile(file);
                      }}
                      className="rounded-md bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-800"
                    >
                      {copy.tryAgain}
                    </button>
                  ) : null}
                </div>
              ) : s.phase !== "complete" ? (
                <UploadProgressBar className="mt-2" percent={s.progress} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {partialErrors && partialErrors.length > 0 ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          <p className="font-medium">{copy.partialUploadError}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
            {partialErrors.map((e) => (
              <li key={`${e.file}:${e.error}`}>
                <span className="font-medium">{e.file}</span>: {e.error}
              </li>
            ))}
          </ul>
        </div>
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
              {copy.retryFailedUploads}
            </button>
          ) : null}
        </div>
      ) : null}

      {successMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {successMessage}
        </p>
      ) : null}

      {pendingDeleteId ? (
        <DeletePhotoConfirm
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDeleteId(null)}
          busy={deleteBusy}
          patientCopy={patientCopy}
        />
      ) : null}

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-sm ${
          drag ? "border-cyan-600 bg-cyan-50/50" : "border-slate-300"
        }`}
        onDragOver={(e) => {
          if (!locked && !disabled) {
            e.preventDefault();
            setDrag(true);
          }
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (locked || disabled) return;
          e.preventDefault();
          setDrag(false);
          const files = Array.from(e.dataTransfer.files).filter((f) => acceptsFile(f, accept));
          onUpload(files.slice(0, remaining));
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-slate-800">{drag ? copy.dropHint : copy.dragHint}</p>
            <p className="mt-0.5 text-xs text-slate-500">{uploadedLine}</p>
          </div>
          {!locked && remaining > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <label
                htmlFor={`patient-upload-camera-${category}`}
                className={`cursor-pointer rounded-md px-3 py-2.5 text-center text-xs font-semibold ${
                  disabled
                    ? "bg-gray-200 text-gray-500"
                    : "border border-cyan-200 bg-cyan-50 text-cyan-900 hover:bg-cyan-100"
                }`}
              >
                {busy ? copy.uploading : copy.takePhoto}
                <input
                  id={`patient-upload-camera-${category}`}
                  type="file"
                  className="hidden"
                  accept={accept}
                  capture="environment"
                  disabled={disabled}
                  onChange={handleInput}
                />
              </label>
              <label
                htmlFor={`patient-upload-files-${category}`}
                className={`cursor-pointer rounded-md px-3 py-2.5 text-center text-xs font-semibold ${
                  disabled
                    ? "bg-gray-200 text-gray-500"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {copy.choosePhoto}
                <input
                  id={`patient-upload-files-${category}`}
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
            <span className="text-xs text-slate-500">{locked ? copy.locked : copy.maxReached}</span>
          )}
        </div>
      </div>

      {existing.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {existing.slice(0, 6).map((u) => (
            <UploadedThumb
              key={u.id}
              upload={u}
              caseId={caseId}
              locked={locked}
              deleteMode="parent"
              onDeleteRequest={() => setPendingDeleteId(u.id)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
