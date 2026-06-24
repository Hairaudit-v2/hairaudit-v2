"use client";

import { useMemo } from "react";
import ImageLightbox from "@/components/uploads/ImageLightbox";
import AuditorImageCategorySelect from "@/components/auditor/AuditorImageCategorySelect";
import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import {
  AUDITOR_QUICK_ACTIONS,
  categoryMatchesSuggestion,
  formatUploadDate,
  isUncategorizedCategoryKey,
  readClassifierSuggestion,
} from "@/lib/auditor/auditorImageSortingUx";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import {
  displayNameFromPatientUpload,
  isPatientUploadAuditExcluded,
  storagePathPatientCategoryFolder,
} from "@/lib/uploads/patientPhotoAuditMeta";

export type AuditorImageSortCardUpload = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  signedUrl?: string | null;
  categoryIntegrity?: { needsAttention: boolean; issues: string[] };
};

export default function AuditorImageSortCard({
  upload,
  pathway,
  category,
  disabled,
  bulkSelected,
  bulkMode,
  pendingAssignCategory,
  onToggleBulk,
  onReassign,
  onRename,
  onExclude,
  onRestore,
  onExpand,
}: {
  upload: AuditorImageSortCardUpload;
  pathway: PatientReviewPathway;
  category: string;
  disabled?: boolean;
  bulkSelected?: boolean;
  bulkMode?: boolean;
  pendingAssignCategory?: string | null;
  onToggleBulk?: () => void;
  onReassign: (categoryKey: string) => void;
  onRename: () => void;
  onExclude: () => void;
  onRestore: () => void;
  onExpand: () => void;
}) {
  const excluded = isPatientUploadAuditExcluded(upload);
  const name = displayNameFromPatientUpload(upload);
  const suggestion = useMemo(() => readClassifierSuggestion(upload.metadata), [upload.metadata]);
  const uncategorized = isUncategorizedCategoryKey(category);
  const needsAttention =
    uncategorized ||
    upload.categoryIntegrity?.needsAttention ||
    (suggestion != null && !categoryMatchesSuggestion(category, suggestion) && suggestion.isLowConfidence);

  const categoryLabel = uncategorized ? "Uncategorized" : auditorPatientPhotoCategoryLabel(category);

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border transition-shadow ${
        excluded
          ? "border-rose-500/35 bg-rose-950/20"
          : needsAttention
            ? "border-amber-500/45 bg-amber-950/15 ring-1 ring-amber-500/20"
            : "border-slate-700 bg-slate-950/60"
      } ${bulkSelected ? "ring-2 ring-cyan-400/60" : ""}`}
    >
      <div className="relative">
        {bulkMode ? (
          <label className="absolute left-2 top-2 z-10 flex cursor-pointer items-center gap-1 rounded bg-black/50 px-2 py-1 text-[10px] text-white">
            <input
              type="checkbox"
              checked={bulkSelected}
              onChange={onToggleBulk}
              disabled={disabled}
              className="rounded"
            />
            Select
          </label>
        ) : null}
        <button
          type="button"
          onClick={onExpand}
          disabled={disabled || !upload.signedUrl}
          className="group block w-full text-left"
          aria-label={`Expand ${name}`}
        >
          <div className="aspect-[4/3] w-full overflow-hidden bg-slate-800">
            {upload.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={upload.signedUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">No preview</div>
            )}
          </div>
        </button>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6">
          <p className="truncate text-sm font-semibold text-white">{categoryLabel}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="truncate text-sm font-medium text-slate-100">{name}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{formatUploadDate(upload.created_at)}</p>
          {!uncategorized ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600">Key: {category}</p>
          ) : null}
        </div>

        {suggestion && !categoryMatchesSuggestion(category, suggestion) ? (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 text-[11px] text-cyan-100">
            <span className="font-medium">Suggested: {suggestion.label}</span>
            {suggestion.confidence != null ? (
              <span className="text-cyan-200/70"> · {Math.round(suggestion.confidence * 100)}%</span>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onReassign(suggestion.categoryKey)}
              className="ml-2 rounded border border-cyan-400/40 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-50 hover:bg-cyan-500/20"
            >
              Accept
            </button>
          </div>
        ) : null}

        {(() => {
          const folder = storagePathPatientCategoryFolder(upload.storage_path);
          if (!folder || folder === category) return null;
          return (
            <p className="text-[10px] text-amber-200/85">
              Storage folder “{folder}” ≠ effective “{category}”
            </p>
          );
        })()}

        <div className="flex flex-wrap gap-1">
          {excluded ? (
            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200">
              Excluded
            </span>
          ) : null}
          {upload.categoryIntegrity?.needsAttention ? (
            <span className="rounded border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
              Mismatch
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {AUDITOR_QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={disabled || action.categoryKey === category}
              onClick={() => onReassign(action.categoryKey)}
              className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              {action.label}
            </button>
          ))}
        </div>

        <AuditorImageCategorySelect
          pathway={pathway}
          excludeKey={category}
          onChange={onReassign}
          disabled={disabled}
          aria-label={`Move ${name} to category`}
        />

        <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-800 pt-2">
          {pendingAssignCategory ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onReassign(pendingAssignCategory)}
              className="rounded-md border border-cyan-500/50 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
            >
              Assign → {auditorPatientPhotoCategoryLabel(pendingAssignCategory)}
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={onRename}
            className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            Rename
          </button>
          {excluded ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onRestore}
              className="rounded-md border border-emerald-600/50 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-950/40"
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={onExclude}
              className="rounded-md border border-rose-600/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-950/30"
            >
              Exclude
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function AuditorImageSortCardLightbox({
  upload,
  caseId,
  category,
  onClose,
}: {
  upload: AuditorImageSortCardUpload;
  caseId: string;
  category: string;
  onClose: () => void;
}) {
  const label = isUncategorizedCategoryKey(category)
    ? displayNameFromPatientUpload(upload)
    : auditorPatientPhotoCategoryLabel(category);
  return (
    <ImageLightbox upload={upload} caseId={caseId} label={label} onClose={onClose} />
  );
}
