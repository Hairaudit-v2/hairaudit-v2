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
import PatientImageEvidenceNudgeCallout from "@/components/patient/PatientImageEvidenceNudgeCallout";
import EvidenceUploadGuidancePanel from "@/components/patient/EvidenceUploadGuidancePanel";
import { computePatientImageEvidenceQualityFromCaseUploads } from "@/lib/audit/patientImageEvidenceConfidence";
import { buildPatientImageEvidenceUploadNudges } from "@/lib/audit/patientImageEvidenceUploadNudges";
import { isPatientImageEvidenceNudgesEnabled } from "@/lib/features/enablePatientImageEvidenceNudges";
import type { PatientPhotoUploadGuidancePanel } from "@/lib/patientPhoto/patientPhotoUploadGuidance";
import { evaluateEvidence, type CasePhotoInput } from "@/lib/evidence/evidenceEvaluator";
import { getUploadHighlightKeys } from "@/lib/evidence/evidenceUploadUiHints";
import { caseSubmitSurfaceOpen } from "@/lib/patient/caseSubmitStatus";
import {
  DEFAULT_PATIENT_REVIEW_PATHWAY,
  computePathwayUploadProgress,
  getMissingPathwayRequiredUploadKeys,
  getPathwayEvidencePack,
  resolvePathwayPhotoSlotDefs,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import PatientUploadRequirementsBanner from "@/components/patient/PatientUploadRequirementsBanner";
import PathwayEvidenceUploadSection from "@/components/patient/PathwayEvidenceUploadSection";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { formatTemplate } from "@/lib/i18n/formatTemplate";
import {
  PATIENT_UPLOAD_SAVE_LATER_MESSAGE,
  computeRequiredUploadProgress,
} from "@/lib/uploads/patientUploadClient";
import UploadPhotoCard, { type PhotoSlotStatus } from "@/components/patient/upload/UploadPhotoCard";
import UploadErrorToast, { type UploadToast } from "@/components/patient/upload/UploadErrorToast";
import {
  uploadPatientPhotoFiles,
  type PerFileUploadState,
} from "@/lib/uploads/uploadPatientPhotos";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: unknown;
  created_at: string;
};

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
  patientReviewPathway = DEFAULT_PATIENT_REVIEW_PATHWAY,
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
  /** HA-DUAL-PATHWAY-1 — filters required upload keys for patient cases */
  patientReviewPathway?: PatientReviewPathway;
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [busyCats, setBusyCats] = useState<Record<string, boolean>>({});
  const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({});
  const [categorySuccess, setCategorySuccess] = useState<Record<string, string>>({});
  const [qualityWarnings, setQualityWarnings] = useState<Record<string, string>>({});
  const [failedFilesByCategory, setFailedFilesByCategory] = useState<Record<string, File[]>>({});
  const [partialErrorsByCategory, setPartialErrorsByCategory] = useState<
    Record<string, Array<{ file: string; error: string }>>
  >({});
  const [fileUploadStatesByCategory, setFileUploadStatesByCategory] = useState<
    Record<string, PerFileUploadState[]>
  >({});
  const [toast, setToast] = useState<UploadToast | null>(null);
  const [skippedOptional, setSkippedOptional] = useState<Set<string>>(new Set());
  const { t } = useI18n();

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
  const requiredKeys =
    submitterType === "patient"
      ? getRequiredKeys("patient", patientReviewPathway)
      : getRequiredKeys(submitterType);
  const pathwayProgress =
    submitterType === "patient"
      ? computePathwayUploadProgress(patientReviewPathway, photosForScoring)
      : null;
  const missingPathwayRequired =
    submitterType === "patient"
      ? getMissingPathwayRequiredUploadKeys(patientReviewPathway, photosForScoring)
      : [];
  const missingRequired =
    submitterType === "patient" ? missingPathwayRequired : requiredKeys.filter((k) => !completed.has(k));
  const canProceed = missingRequired.length === 0;
  const requiredProgress =
    submitterType === "patient" && pathwayProgress
      ? {
          completed: pathwayProgress.completed,
          total: pathwayProgress.total,
          percent: pathwayProgress.percent,
        }
      : submitterType === "patient"
        ? computeRequiredUploadProgress(requiredKeys, completed)
        : null;
  const evidencePack =
    submitterType === "patient" ? getPathwayEvidencePack(patientReviewPathway) : null;
  const pathwaySlotDefs =
    submitterType === "patient" ? resolvePathwayPhotoSlotDefs(patientReviewPathway) : [];
  const resolvedNextLabel =
    submitterType === "patient" && evidencePack
      ? t(evidencePack.continueButtonKey as TranslationKey)
      : nextLabel;

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

  function showToast(message: string, variant: UploadToast["variant"] = "error") {
    setToast({ id: `${Date.now()}`, message, variant });
  }

  function resolveSlotStatus(
    def: { required: boolean; min: number },
    category: string,
    emphasize?: boolean
  ): PhotoSlotStatus {
    const existing = uploadsByCategory[category] ?? [];
    if (busyCats[category]) return "uploading";
    if ((failedFilesByCategory[category]?.length ?? 0) > 0) return "needs_retry";
    if (existing.length >= def.min) return "complete";
    if (def.required) return "required";
    if (emphasize) return "recommended";
    return "optional";
  }

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
    setPartialErrorsByCategory((p) => {
      const next = { ...p };
      delete next[category];
      return next;
    });
    setFileUploadStatesByCategory((p) => ({ ...p, [category]: [] }));

    try {
      const result = await uploadPatientPhotoFiles({
        caseId,
        category,
        files,
        submitterType,
        onFileStateChange: (states) => {
          setFileUploadStatesByCategory((p) => ({ ...p, [category]: states }));
        },
      });

      if (result.saved.length > 0) {
        setUploads((prev) => [...result.saved, ...prev]);
        if (result.qualityWarning) {
          setQualityWarnings((p) => ({ ...p, [category]: result.qualityWarning! }));
        }
      }

      if (result.confidenceMessage) {
        setCategorySuccess((p) => ({ ...p, [category]: result.confidenceMessage! }));
        if (submitterType === "patient") {
          showToast(result.confidenceMessage, "success");
        }
      }

      if (result.partialErrors.length > 0) {
        setPartialErrorsByCategory((p) => ({ ...p, [category]: result.partialErrors }));
      }

      if (result.failedFiles.length > 0) {
        setFailedFilesByCategory((p) => ({ ...p, [category]: result.failedFiles }));
        setCategoryErrors((p) => ({
          ...p,
          [category]:
            result.successCount > 0
              ? `${result.successCount} saved, but ${result.failedFiles.length} failed. Tap retry to try again.`
              : result.partialErrors[0]?.error ?? "Upload failed. Please try again.",
        }));
      } else if (isRetry || result.successCount > 0) {
        setFailedFilesByCategory((p) => {
          const next = { ...p };
          delete next[category];
          return next;
        });
      }
    } finally {
      setBusyCats((p) => ({ ...p, [category]: false }));
      setFileUploadStatesByCategory((p) => {
        const next = { ...p };
        delete next[category];
        return next;
      });
    }
  }

  function deleteUpload(uploadId: string) {
    if (isLocked) return;
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }

  function patientImageQualityLabel(score: string): string {
    switch (score) {
      case "A":
        return "Excellent for review";
      case "B":
        return "Good for review";
      case "C":
        return "Adequate for review";
      case "D":
        return "Limited — extra photos may help";
      default:
        return score;
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
            : evidencePack
              ? t(evidencePack.purposeKey as TranslationKey)
              : "Upload at least the 3 required current photos. Extra photos can help us give you a clearer review."}
        </p>

        {submitterType === "patient" && (
          <>
            <div className="mt-4">
              <PatientUploadRequirementsBanner patientReviewPathway={patientReviewPathway} />
            </div>
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {PATIENT_UPLOAD_SAVE_LATER_MESSAGE}
            </p>
          </>
        )}

        {requiredProgress && requiredProgress.total > 0 ? (
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  {t("patient.upload.progress.required" as TranslationKey)}
                </span>
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
                  {t("patient.upload.progress.requiredComplete" as TranslationKey)}
                </p>
              ) : null}
            </div>
            {pathwayProgress && pathwayProgress.recommendedTotal > 0 ? (
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    {t("patient.upload.progress.recommended" as TranslationKey)}
                  </span>
                  <span className="text-slate-600">
                    {pathwayProgress.recommendedCompleted} / {pathwayProgress.recommendedTotal}
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-valuenow={pathwayProgress.recommendedPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all duration-300"
                    style={{ width: `${pathwayProgress.recommendedPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
            {pathwayProgress && pathwayProgress.optionalAvailable > 0 ? (
              <p className="text-xs text-slate-500">
                {formatTemplate(t("patient.upload.progress.optionalAvailable" as TranslationKey), {
                  count: String(pathwayProgress.optionalAvailable),
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <span className="text-sm font-medium text-slate-600">Image quality:</span>{" "}
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 text-sm font-semibold ${
                score === "A"
                  ? "bg-green-100 text-green-800"
                  : score === "B"
                    ? "bg-blue-100 text-blue-800"
                    : score === "C"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
              }`}
            >
              {submitterType === "patient" ? patientImageQualityLabel(score) : score}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-600">Review confidence:</span>{" "}
            <span className="text-sm font-medium">{confidence}</span>
          </div>
          {missingRequired.length > 0 && (
            <div className="text-sm text-amber-700">
              {t("patient.upload.progress.stillNeeded" as TranslationKey)}:{" "}
              {missingRequired
                .map((k) => {
                  const def = pathwaySlotDefs.find((d) => d.key === k);
                  return def ? t(def.labelKey as TranslationKey) : k;
                })
                .join(", ")}
            </div>
          )}
          {evidencePack ? (
            <div className="text-sm text-slate-600">
              {t(evidencePack.confidenceMessageKey as TranslationKey)}
            </div>
          ) : null}
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
        {submitterType === "patient" ? (
          <PathwayEvidenceUploadSection
            pathway={patientReviewPathway}
            caseId={caseId}
            locked={isLocked}
            busyCats={busyCats}
            uploadsByCategory={uploadsByCategory}
            highlightCategoryKeys={evidenceUi?.highlightKeys}
            categoryErrors={categoryErrors}
            categorySuccess={categorySuccess}
            qualityWarnings={qualityWarnings}
            partialErrorsByCategory={partialErrorsByCategory}
            fileUploadStatesByCategory={fileUploadStatesByCategory}
            failedFilesByCategory={failedFilesByCategory}
            skippedOptional={skippedOptional}
            onUpload={(cat, files) => {
              void uploadFiles(cat, files);
            }}
            onDeleted={deleteUpload}
            onRetryCategory={(cat) => {
              const failed = failedFilesByCategory[cat];
              if (failed?.length) void uploadFiles(cat, failed, true);
            }}
            onRetryFile={(cat, file) => void uploadFiles(cat, [file], true)}
            onDeleteError={(msg) => showToast(msg)}
            onSkipOptional={(key) => toggleSkipped(key)}
          />
        ) : (
          schema.map((def) => {
            const hidden = def.required === false && skippedOptional.has(def.key);
            if (hidden) return null;

            return (
              <UploadPhotoCard
                key={def.key}
                caseId={caseId}
                category={def.key}
                title={def.title}
                help={def.help}
                quickTips={def.quickTips}
                slotStatus={resolveSlotStatus(def, def.key, evidenceUi?.highlightKeys.has(def.key))}
                min={def.min}
                max={def.max}
                accept={def.accept ?? "image/*"}
                existing={uploadsByCategory[def.key] ?? []}
                locked={isLocked}
                emphasize={evidenceUi?.highlightKeys.has(def.key) ?? false}
                showCantProvide={def.required === false && submitterType === "patient"}
                errorMessage={categoryErrors[def.key]}
                successMessage={categorySuccess[def.key]}
                qualityWarning={qualityWarnings[def.key]}
                partialErrors={partialErrorsByCategory[def.key]}
                fileUploadStates={fileUploadStatesByCategory[def.key]}
                failedFiles={failedFilesByCategory[def.key]}
                onRetry={() => {
                  const failed = failedFilesByCategory[def.key];
                  if (failed?.length) void uploadFiles(def.key, failed, true);
                }}
                onRetryFile={(file) => void uploadFiles(def.key, [file], true)}
                onSkip={() => toggleSkipped(def.key)}
                onUpload={(files) => uploadFiles(def.key, files)}
                onDeleted={deleteUpload}
                onDeleteError={(msg) => showToast(msg)}
              />
            );
          })
        )}
      </div>

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
          {(submitterType === "patient" ? pathwaySlotDefs : schema).map((def) => {
            const key = def.key;
            const title =
              submitterType === "patient"
                ? t((def as (typeof pathwaySlotDefs)[number]).labelKey as TranslationKey)
                : (def as (typeof schema)[number]).title;
            const min = def.min;
            const count = uploadsByCategory[key]?.length ?? 0;
            const ok = min > 0 ? count >= min : count > 0;
            return (
              <li key={key} className="flex justify-between">
                <span>{title}</span>
                <span className={ok ? "text-green-600" : "text-amber-600"}>
                  {count} / {min} min {ok ? "✓" : ""}
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
              {resolvedNextLabel}
            </Link>
          ) : (
            <span className="rounded-md px-4 py-2 font-medium cursor-not-allowed bg-gray-200 text-gray-500">
              {resolvedNextLabel}
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
      <UploadErrorToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
