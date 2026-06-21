"use client";

import React from "react";
import UploadPhotoCard, { type PhotoSlotStatus } from "@/components/patient/upload/UploadPhotoCard";
import { isExtendedPatientUploadsEnabled } from "@/lib/features/enableExtendedPatientUploads";
import type { PatientUploadCategoryKey } from "@/lib/patientPhotoCategoryConfig";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import { filterUploadCategoriesForPathway } from "@/lib/patient/patientReviewPathway";
import {
  getPatientExtendedUploadGroupsResolved,
  PATIENT_EXTENDED_UPLOAD_MICROCOPY,
  type PatientExtendedUploadGroupId,
} from "@/lib/patientExtendedUploadUi";
import { orderExtendedUploadGroupsByHint } from "@/lib/patientPhoto/patientPhotoUploadGuidance";
import type { PerFileUploadState } from "@/lib/uploads/uploadPatientPhotos";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: unknown;
  created_at: string;
};

type Skin = "audit" | "legacy";

function resolveOptionalSlotStatus(
  minFiles: number,
  existingCount: number,
  busy: boolean,
  failedCount: number,
  emphasize: boolean
): PhotoSlotStatus {
  if (busy) return "uploading";
  if (failedCount > 0) return "needs_retry";
  if (existingCount >= minFiles && existingCount > 0) return "complete";
  if (emphasize) return "recommended";
  return "optional";
}

export default function ExtendedPatientPhotoUploadGroups({
  enabled: enabledProp,
  locked,
  busyCats,
  uploadsByCategory,
  onUpload,
  onDeleted,
  skin = "audit",
  extendedGroupOrderHint,
  highlightCategoryKeys,
  caseId,
  categoryErrors,
  categorySuccess,
  qualityWarnings,
  partialErrorsByCategory,
  fileUploadStatesByCategory,
  failedFilesByCategory,
  onRetryCategory,
  onRetryFile,
  onDeleteError,
  patientReviewPathway,
}: {
  enabled?: boolean;
  locked: boolean;
  busyCats: Record<string, boolean>;
  uploadsByCategory: Record<string, UploadRow[]>;
  onUpload: (category: PatientUploadCategoryKey, files: File[]) => void;
  onDeleted: (uploadId: string) => void;
  skin?: Skin;
  extendedGroupOrderHint?: readonly PatientExtendedUploadGroupId[] | null;
  highlightCategoryKeys?: ReadonlySet<string>;
  caseId?: string;
  categoryErrors?: Record<string, string>;
  categorySuccess?: Record<string, string>;
  qualityWarnings?: Record<string, string>;
  partialErrorsByCategory?: Record<string, Array<{ file: string; error: string }>>;
  fileUploadStatesByCategory?: Record<string, PerFileUploadState[]>;
  failedFilesByCategory?: Record<string, File[]>;
  onRetryCategory?: (category: string) => void;
  onRetryFile?: (category: string, file: File) => void;
  onDeleteError?: (message: string) => void;
  /** When set, only categories relevant to this pathway are shown. */
  patientReviewPathway?: PatientReviewPathway;
}) {
  const envEnabled = isExtendedPatientUploadsEnabled();
  const enabled = envEnabled || enabledProp === true;

  if (!enabled) return null;

  const baseGroups = getPatientExtendedUploadGroupsResolved();
  const groups =
    extendedGroupOrderHint && extendedGroupOrderHint.length > 0
      ? orderExtendedUploadGroupsByHint(baseGroups, extendedGroupOrderHint)
      : baseGroups;
  const shell =
    skin === "audit"
      ? "rounded-xl border border-slate-200 bg-slate-50/40"
      : "rounded-xl border border-gray-200 bg-gray-50/50";
  const summaryCls =
    skin === "audit"
      ? "cursor-pointer list-none px-4 py-3 font-medium text-slate-800 hover:bg-slate-100/80 [&::-webkit-details-marker]:hidden"
      : "cursor-pointer list-none px-4 py-3 font-medium text-gray-800 hover:bg-gray-100/80 [&::-webkit-details-marker]:hidden";

  return (
    <section
      className={`mt-8 space-y-4 ${skin === "audit" ? "border-t border-slate-200 pt-8" : "border-t border-gray-200 pt-8"}`}
    >
      <div className={`rounded-lg p-4 ${shell}`}>
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${skin === "audit" ? "text-slate-500" : "text-gray-500"}`}
        >
          {PATIENT_EXTENDED_UPLOAD_MICROCOPY.eyebrow}
        </p>
        <p className={`mt-1 text-sm ${skin === "audit" ? "text-slate-700" : "text-gray-700"}`}>
          {PATIENT_EXTENDED_UPLOAD_MICROCOPY.body}
        </p>
      </div>

      {groups.map((group) => (
        <details key={group.id} className={`group ${shell}`}>
          <summary className={summaryCls}>
            <span className="flex items-center justify-between gap-2">
              <span>
                {group.title}{" "}
                <span
                  className={`text-xs font-normal ${skin === "audit" ? "text-slate-500" : "text-gray-500"}`}
                >
                  (optional)
                </span>
              </span>
              <span aria-hidden className="text-slate-400 text-sm transition group-open:rotate-90">
                ▸
              </span>
            </span>
            <span
              className={`mt-1 block text-xs font-normal ${skin === "audit" ? "text-slate-600" : "text-gray-600"}`}
            >
              {group.groupDescription}
            </span>
          </summary>

          <div className="space-y-4 border-t border-slate-200/80 px-3 py-4">
            {(patientReviewPathway
              ? filterUploadCategoriesForPathway(group.categories, patientReviewPathway)
              : group.categories
            ).map((cat) => {
              const k = cat.key as PatientUploadCategoryKey;
              const existing = uploadsByCategory[cat.key] ?? [];
              const emphasize = highlightCategoryKeys?.has(cat.key) ?? false;
              const busy = !!busyCats[cat.key];
              const failedCount = failedFilesByCategory?.[cat.key]?.length ?? 0;

              return (
                <UploadPhotoCard
                  key={cat.key}
                  caseId={caseId ?? ""}
                  category={cat.key}
                  title={cat.label}
                  help={cat.description}
                  quickTips={cat.tips}
                  slotStatus={resolveOptionalSlotStatus(
                    cat.minFiles,
                    existing.length,
                    busy,
                    failedCount,
                    emphasize
                  )}
                  min={cat.minFiles}
                  max={cat.maxFiles}
                  accept={cat.accept}
                  existing={existing}
                  locked={locked}
                  emphasize={emphasize}
                  errorMessage={categoryErrors?.[cat.key]}
                  successMessage={categorySuccess?.[cat.key]}
                  qualityWarning={qualityWarnings?.[cat.key]}
                  partialErrors={partialErrorsByCategory?.[cat.key]}
                  fileUploadStates={fileUploadStatesByCategory?.[cat.key]}
                  failedFiles={failedFilesByCategory?.[cat.key]}
                  onRetry={
                    onRetryCategory ? () => onRetryCategory(cat.key) : undefined
                  }
                  onRetryFile={
                    onRetryFile ? (file) => onRetryFile(cat.key, file) : undefined
                  }
                  onUpload={(files) => onUpload(k, files)}
                  onDeleted={onDeleted}
                  onDeleteError={onDeleteError}
                  compact
                />
              );
            })}
          </div>
        </details>
      ))}
    </section>
  );
}
