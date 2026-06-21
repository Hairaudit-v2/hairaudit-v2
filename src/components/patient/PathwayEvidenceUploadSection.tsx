"use client";

import React from "react";
import UploadPhotoCard, { type PhotoSlotStatus } from "@/components/patient/upload/UploadPhotoCard";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import {
  resolvePathwayPhotoSlotDef,
  uploadGroupsByPathway,
  type PatientReviewPathway,
  type PathwayEvidenceTier,
} from "@/lib/patient/patientReviewPathway";
import type { PerFileUploadState } from "@/lib/uploads/uploadPatientPhotos";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: unknown;
  created_at: string;
};

function tierDefaultOpen(tier: PathwayEvidenceTier): boolean {
  return tier === "required";
}

export default function PathwayEvidenceUploadSection({
  pathway,
  caseId,
  locked,
  busyCats,
  uploadsByCategory,
  highlightCategoryKeys,
  categoryErrors,
  categorySuccess,
  qualityWarnings,
  partialErrorsByCategory,
  fileUploadStatesByCategory,
  failedFilesByCategory,
  skippedOptional,
  visibleTiers,
  tierTitleOverrides,
  expandNonRequiredSections,
  onUpload,
  onDeleted,
  onRetryCategory,
  onRetryFile,
  onDeleteError,
  onSkipOptional,
}: {
  pathway: PatientReviewPathway;
  caseId: string;
  locked: boolean;
  busyCats: Record<string, boolean>;
  uploadsByCategory: Record<string, UploadRow[]>;
  highlightCategoryKeys?: ReadonlySet<string>;
  categoryErrors?: Record<string, string>;
  categorySuccess?: Record<string, string>;
  qualityWarnings?: Record<string, string>;
  partialErrorsByCategory?: Record<string, Array<{ file: string; error: string }>>;
  fileUploadStatesByCategory?: Record<string, PerFileUploadState[]>;
  failedFilesByCategory?: Record<string, File[]>;
  skippedOptional: Set<string>;
  visibleTiers?: readonly PathwayEvidenceTier[];
  tierTitleOverrides?: Partial<Record<PathwayEvidenceTier, { titleKey: string; descriptionKey: string }>>;
  expandNonRequiredSections?: boolean;
  onUpload: (category: string, files: File[]) => void;
  onDeleted: (uploadId: string) => void;
  onRetryCategory?: (category: string) => void;
  onRetryFile?: (category: string, file: File) => void;
  onDeleteError?: (message: string) => void;
  onSkipOptional: (key: string) => void;
}) {
  const { t } = useI18n();
  const groups = uploadGroupsByPathway[pathway].filter(
    (group) => !visibleTiers || visibleTiers.includes(group.tier)
  );

  function resolveSlotStatus(
    tier: PathwayEvidenceTier,
    category: string,
    min: number,
    emphasize?: boolean
  ): PhotoSlotStatus {
    const existing = uploadsByCategory[category] ?? [];
    if (busyCats[category]) return "uploading";
    if ((failedFilesByCategory?.[category]?.length ?? 0) > 0) return "needs_retry";
    if (existing.length >= min && (min > 0 ? true : existing.length > 0)) return "complete";
    if (tier === "required") return "required";
    if (emphasize) return "recommended";
    return tier === "recommended" ? "recommended" : "optional";
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const visibleKeys = group.keys.filter(
          (key) => group.tier !== "optional" || !skippedOptional.has(key)
        );
        if (visibleKeys.length === 0) return null;

        const sectionBody = (
          <div className="space-y-4">
            {visibleKeys.map((key) => {
              const def = resolvePathwayPhotoSlotDef(pathway, key);
              if (!def) return null;

              const title = t(def.labelKey as TranslationKey);
              const help = t(def.descriptionKey as TranslationKey);
              const emphasize = highlightCategoryKeys?.has(key) ?? false;
              const slotStatus = resolveSlotStatus(def.tier, key, def.min, emphasize);

              return (
                <UploadPhotoCard
                  key={key}
                  caseId={caseId}
                  category={key}
                  title={title}
                  help={help}
                  quickTips={def.quickTips}
                  slotStatus={slotStatus}
                  min={def.min}
                  max={def.max}
                  accept={def.accept}
                  existing={uploadsByCategory[key] ?? []}
                  locked={locked}
                  emphasize={emphasize}
                  showCantProvide={def.tier !== "required"}
                  errorMessage={categoryErrors?.[key]}
                  successMessage={categorySuccess?.[key]}
                  qualityWarning={qualityWarnings?.[key]}
                  partialErrors={partialErrorsByCategory?.[key]}
                  fileUploadStates={fileUploadStatesByCategory?.[key]}
                  failedFiles={failedFilesByCategory?.[key]}
                  onRetry={onRetryCategory ? () => onRetryCategory(key) : undefined}
                  onRetryFile={onRetryFile ? (file) => onRetryFile(key, file) : undefined}
                  onSkip={def.tier !== "required" ? () => onSkipOptional(key) : undefined}
                  onUpload={(files) => onUpload(key, files)}
                  onDeleted={onDeleted}
                  onDeleteError={onDeleteError}
                  patientCopy
                />
              );
            })}
          </div>
        );

        const tierOverride = tierTitleOverrides?.[group.tier];
        const sectionTitleKey = tierOverride?.titleKey ?? group.titleKey;
        const sectionDescriptionKey = tierOverride?.descriptionKey ?? group.descriptionKey;

        if (group.tier === "required") {
          return (
            <section key={group.tier} data-testid="upload-required-section" className="space-y-3">
              <header>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t(sectionTitleKey as TranslationKey)}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {t(sectionDescriptionKey as TranslationKey)}
                </p>
              </header>
              {sectionBody}
            </section>
          );
        }

        const tierTestId =
          group.tier === "recommended"
            ? "upload-recommended-section"
            : group.tier === "optional"
              ? "upload-optional-section"
              : undefined;

        return (
          <details
            key={group.tier}
            data-testid={tierTestId}
            className="rounded-xl border border-slate-200 bg-white group"
            open={expandNonRequiredSections || tierDefaultOpen(group.tier)}
          >
            <summary className="cursor-pointer list-none px-4 py-3 font-medium text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span>
                  {t(sectionTitleKey as TranslationKey)}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    ({t(`patient.upload.tiers.${group.tier}.label` as TranslationKey)})
                  </span>
                </span>
                <span aria-hidden className="text-slate-400 text-sm transition group-open:rotate-90">
                  ▸
                </span>
              </span>
              <span className="mt-1 block text-xs font-normal text-slate-600">
                {t(sectionDescriptionKey as TranslationKey)}
              </span>
            </summary>
            <div className="space-y-4 border-t border-slate-200/80 px-3 py-4">{sectionBody}</div>
          </details>
        );
      })}
    </div>
  );
}
