"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PathwayEvidenceUploadSection from "@/components/patient/PathwayEvidenceUploadSection";
import UploadPhotoCard, { type PhotoSlotStatus } from "@/components/patient/upload/UploadPhotoCard";
import UploadErrorToast, { type UploadToast } from "@/components/patient/upload/UploadErrorToast";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { formatTemplate } from "@/lib/i18n/formatTemplate";
import { caseSubmitSurfaceOpen } from "@/lib/patient/caseSubmitStatus";
import {
  canAccessGuidedWizardStep,
  getGuidedWizardInitialView,
  getGuidedWizardRequiredKeys,
  isGuidedWizardStepComplete,
  resolveGuidedWizardStepAfterUpload,
  type GuidedWizardView,
} from "@/lib/patient/guidedPatientUploadWizard";
import {
  computePathwayUploadProgress,
  resolvePathwayPhotoSlotDef,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import {
  getPatientUploadEncouragementMessageKey,
  PATIENT_UPLOAD_ENCOURAGEMENT_PAUSE_MS,
} from "@/lib/uploads/patientUploadEncouragementMessages";
import {
  uploadPatientPhotoFiles,
  type PerFileUploadState,
} from "@/lib/uploads/uploadPatientPhotos";
import { toPatientFacingUploadError } from "@/lib/uploads/patientUploadClient";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: unknown;
  created_at: string;
};

type PendingEncouragement = {
  nextPhotos: Array<{ type?: string | null }>;
  messageKey: TranslationKey;
};

function categoryFromType(type: string): string | null {
  if (!type?.startsWith("patient_photo:")) return null;
  return type.slice("patient_photo:".length);
}

export default function GuidedPatientUploadWizard({
  caseId,
  initialUploads,
  caseStatus,
  submittedAt,
  patientReviewPathway,
  backHref,
  questionsHref,
}: {
  caseId: string;
  initialUploads: UploadRow[];
  caseStatus: string;
  submittedAt?: string | null;
  patientReviewPathway: PatientReviewPathway;
  backHref: string;
  questionsHref: string;
}) {
  const { t } = useI18n();
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
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [optionalRevealed, setOptionalRevealed] = useState(false);
  const [skippedOptional, setSkippedOptional] = useState<Set<string>>(new Set());
  const [pendingEncouragement, setPendingEncouragement] = useState<PendingEncouragement | null>(
    null
  );
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialView = getGuidedWizardInitialView(patientReviewPathway, initialUploads);
  const [view, setView] = useState<GuidedWizardView>(initialView);

  const isLocked = !caseSubmitSurfaceOpen({ status: caseStatus, submitted_at: submittedAt });
  const requiredKeys = getGuidedWizardRequiredKeys(patientReviewPathway);
  const pathwayLabelKey =
    patientReviewPathway === "pre_surgery"
      ? "marketing.home.pathways.preSurgery.title"
      : "marketing.home.pathways.postSurgery.title";

  const photosForScoring = useMemo(() => uploads.map((u) => ({ type: u.type })), [uploads]);
  const pathwayProgress = computePathwayUploadProgress(patientReviewPathway, photosForScoring);
  const allRequiredComplete = pathwayProgress.completed === pathwayProgress.total;

  const uploadsByCategory = useMemo(() => {
    const map: Record<string, UploadRow[]> = {};
    for (const u of uploads) {
      const cat = categoryFromType(u.type);
      if (!cat) continue;
      (map[cat] ||= []).push(u);
    }
    return map;
  }, [uploads]);

  const stepIndex = view.mode === "step" ? view.stepIndex : requiredKeys.length - 1;
  const currentKey = requiredKeys[stepIndex] ?? requiredKeys[0];
  const currentSlotDef = resolvePathwayPhotoSlotDef(patientReviewPathway, currentKey);
  const currentExisting = uploadsByCategory[currentKey] ?? [];
  const currentStepComplete = isGuidedWizardStepComplete(
    patientReviewPathway,
    photosForScoring,
    stepIndex
  );

  const showToast = useCallback((message: string, variant: UploadToast["variant"] = "error") => {
    setToast({ id: `${Date.now()}`, message, variant });
  }, []);

  const patientError = useCallback(
    (raw: string) => {
      const mapped = toPatientFacingUploadError(raw);
      if (mapped === "Please choose a photo from your phone or computer.") {
        return t("patient.upload.messages.unsupportedFileType" as TranslationKey);
      }
      if (mapped === "We had trouble processing that photo. Please try again.") {
        return t("patient.upload.messages.compressionFailed" as TranslationKey);
      }
      if (mapped === "That photo did not upload properly. Please try again.") {
        return t("patient.upload.messages.uploadFailed" as TranslationKey);
      }
      return mapped;
    },
    [t]
  );

  const clearAdvanceTimeout = useCallback(() => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  }, []);

  const scheduleAdvanceAfterEncouragement = useCallback(
    (nextPhotos: Array<{ type?: string | null }>, messageKey: TranslationKey) => {
      clearAdvanceTimeout();
      setPendingEncouragement({ nextPhotos, messageKey });
      const encouragementText = t(messageKey);
      showToast(encouragementText, "success");

      advanceTimeoutRef.current = setTimeout(() => {
        setPendingEncouragement(null);
        const nextView = resolveGuidedWizardStepAfterUpload(patientReviewPathway, nextPhotos);
        setView(nextView);
        advanceTimeoutRef.current = null;
      }, PATIENT_UPLOAD_ENCOURAGEMENT_PAUSE_MS);
    },
    [clearAdvanceTimeout, patientReviewPathway, showToast, t]
  );

  useEffect(() => () => clearAdvanceTimeout(), [clearAdvanceTimeout]);

  const syncViewAfterPhotos = useCallback(
    (nextPhotos: Array<{ type?: string | null }>) => {
      const nextView = resolveGuidedWizardStepAfterUpload(patientReviewPathway, nextPhotos);
      setView(nextView);
    },
    [patientReviewPathway]
  );

  function resolveSlotStatus(category: string, min: number): PhotoSlotStatus {
    const existing = uploadsByCategory[category] ?? [];
    if (busyCats[category]) return "uploading";
    if ((failedFilesByCategory[category]?.length ?? 0) > 0) return "needs_retry";
    if (existing.length >= min) return "complete";
    return "required";
  }

  function maybeEncourageRequiredUpload(
    category: string,
    nextUploads: UploadRow[],
    stepBeforeUpload: number
  ) {
    const wasComplete = isGuidedWizardStepComplete(
      patientReviewPathway,
      uploads.map((u) => ({ type: u.type })),
      stepBeforeUpload
    );
    const nextPhotos = nextUploads.map((u) => ({ type: u.type }));
    const nowComplete = isGuidedWizardStepComplete(
      patientReviewPathway,
      nextPhotos,
      stepBeforeUpload
    );

    if (
      requiredKeys.includes(category) &&
      !wasComplete &&
      nowComplete &&
      view.mode === "step"
    ) {
      const completedCount = computePathwayUploadProgress(
        patientReviewPathway,
        nextPhotos
      ).completed;
      const messageKey = getPatientUploadEncouragementMessageKey(
        patientReviewPathway,
        completedCount
      );
      if (messageKey) {
        scheduleAdvanceAfterEncouragement(nextPhotos, messageKey);
        return;
      }
    }

    syncViewAfterPhotos(nextPhotos);
  }

  async function uploadFiles(category: string, files: File[], isRetry = false) {
    if (isLocked || !files.length) return;

    const stepBeforeUpload = view.mode === "step" ? view.stepIndex : stepIndex;

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
        submitterType: "patient",
        onFileStateChange: (states) => {
          setFileUploadStatesByCategory((p) => ({ ...p, [category]: states }));
        },
      });

      if (result.saved.length > 0) {
        const nextUploads = [...result.saved, ...uploads];
        setUploads(nextUploads);
        if (result.qualityWarning) {
          setQualityWarnings((p) => ({ ...p, [category]: result.qualityWarning! }));
        }

        const isRequiredWizardStep = requiredKeys.includes(category);
        if (isRequiredWizardStep) {
          const completedCount = computePathwayUploadProgress(
            patientReviewPathway,
            nextUploads.map((u) => ({ type: u.type }))
          ).completed;
          const encouragementKey = getPatientUploadEncouragementMessageKey(
            patientReviewPathway,
            completedCount
          );
          if (encouragementKey) {
            const encouragementText = t(encouragementKey);
            setCategorySuccess((p) => ({ ...p, [category]: encouragementText }));
          }
          maybeEncourageRequiredUpload(category, nextUploads, stepBeforeUpload);
        } else {
          if (result.confidenceMessage) {
            setCategorySuccess((p) => ({ ...p, [category]: result.confidenceMessage! }));
            showToast(result.confidenceMessage, "success");
          }
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
              ? formatTemplate(t("patient.upload.messages.partialSuccess" as TranslationKey), {
                  saved: String(result.successCount),
                  failed: String(result.failedFiles.length),
                })
              : patientError(result.partialErrors[0]?.error ?? "Upload failed"),
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
    setUploads((prev) => {
      const next = prev.filter((u) => u.id !== uploadId);
      syncViewAfterPhotos(next.map((u) => ({ type: u.type })));
      return next;
    });
  }

  function goToStep(index: number) {
    if (pendingEncouragement) return;
    if (!canAccessGuidedWizardStep(index, patientReviewPathway, photosForScoring)) return;
    setView({ mode: "step", stepIndex: index });
  }

  async function replaceCurrentPhoto() {
    const first = currentExisting[0];
    if (!first || isLocked || replaceBusy) return;
    setReplaceBusy(true);
    try {
      const res = await fetch(`/api/uploads/delete?uploadId=${encodeURIComponent(first.id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      deleteUpload(first.id);
    } catch {
      showToast(t("patient.upload.messages.replaceFailed" as TranslationKey));
    } finally {
      setReplaceBusy(false);
    }
  }

  function toggleSkippedOptional(key: string) {
    setSkippedOptional((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const continueLabel = t("patient.upload.completion.continue" as TranslationKey);
  const canContinue = allRequiredComplete && !isLocked;
  const showingEncouragement = pendingEncouragement !== null;
  const showCompletionChoices = view.mode === "complete" && !optionalRevealed && !showingEncouragement;
  const showOptionalSection = view.mode === "complete" && optionalRevealed;

  const extraPhotosTierOverrides = {
    recommended: {
      titleKey: "patient.upload.extraPhotos.accuracyPrompt",
      descriptionKey: "patient.upload.extraPhotos.accuracyHint",
    },
    optional: {
      titleKey: "patient.upload.optionalReveal.title",
      descriptionKey: "patient.upload.optionalReveal.subcopy",
    },
  };

  return (
    <div
      data-testid="guided-upload-wizard"
      className="mx-auto max-w-lg space-y-6 p-4 sm:p-6"
    >
      <header className="space-y-3 text-center sm:text-left">
        <p
          className="text-xs font-semibold uppercase tracking-wide text-sky-700"
          data-testid="guided-upload-pathway-label"
        >
          {t(pathwayLabelKey as TranslationKey)}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {t("patient.upload.wizard.heading" as TranslationKey)}
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          {t("patient.upload.wizard.subcopy" as TranslationKey)}
        </p>

        {view.mode === "step" || showingEncouragement ? (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-slate-800" data-testid="guided-upload-step-label">
              {formatTemplate(t("patient.upload.wizard.stepLabel" as TranslationKey), {
                current: String(stepIndex + 1),
                total: String(requiredKeys.length),
              })}
            </p>
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  {formatTemplate(t("patient.upload.wizard.progressLabel" as TranslationKey), {
                    completed: String(pathwayProgress.completed),
                    total: String(pathwayProgress.total),
                  })}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={pathwayProgress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                data-testid="guided-upload-progress"
              >
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${pathwayProgress.percent}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {isLocked ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {t("patient.upload.wizard.lockedMessage" as TranslationKey)}
          </div>
        ) : null}
      </header>

      {showingEncouragement ? (
        <section
          data-testid="guided-upload-encouragement"
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-6 text-center sm:text-left"
        >
          <p className="whitespace-pre-line text-base leading-relaxed text-slate-800">
            {t(pendingEncouragement.messageKey)}
          </p>
        </section>
      ) : null}

      {showCompletionChoices ? (
        <section
          data-testid="guided-upload-completion"
          className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center sm:text-left"
        >
          <div
            className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800"
            data-testid="guided-upload-celebration"
          >
            <span aria-hidden>✓</span>
            <span>{t("patient.upload.completion.celebration" as TranslationKey)}</span>
          </div>
          <p className="mt-3 text-sm text-emerald-800">
            {t("patient.upload.completion.celebrationDetail" as TranslationKey)}
          </p>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            {t("patient.upload.completion.headline" as TranslationKey)}
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            {t("patient.upload.completion.headlineDetail" as TranslationKey)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {t("patient.upload.completion.subcopy" as TranslationKey)}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {canContinue ? (
              <Link
                href={questionsHref}
                data-testid="guided-upload-continue"
                className="inline-flex w-full items-center justify-center rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-400 sm:w-auto"
              >
                {continueLabel}
              </Link>
            ) : (
              <span
                data-testid="guided-upload-continue-disabled"
                className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-gray-200 px-4 py-3 text-sm font-semibold text-gray-500 sm:w-auto"
              >
                {continueLabel}
              </span>
            )}
            <button
              type="button"
              data-testid="guided-upload-add-extra"
              onClick={() => setOptionalRevealed(true)}
              disabled={isLocked}
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
            >
              {t("patient.upload.extraPhotos.addButton" as TranslationKey)}
            </button>
          </div>
        </section>
      ) : null}

      {showOptionalSection ? (
        <section data-testid="guided-upload-optional-reveal" className="space-y-4">
          <header className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("patient.upload.optionalReveal.title" as TranslationKey)}
            </h2>
            <p className="text-sm text-slate-600">
              {t("patient.upload.optionalReveal.subcopy" as TranslationKey)}
            </p>
            <p className="text-sm font-medium text-slate-800">
              {t("patient.upload.extraPhotos.accuracyPrompt" as TranslationKey)}
            </p>
            <p className="text-sm text-slate-600">
              {t("patient.upload.extraPhotos.alreadyEnough" as TranslationKey)}
            </p>
          </header>
          <PathwayEvidenceUploadSection
            pathway={patientReviewPathway}
            caseId={caseId}
            locked={isLocked}
            busyCats={busyCats}
            uploadsByCategory={uploadsByCategory}
            categoryErrors={categoryErrors}
            categorySuccess={categorySuccess}
            qualityWarnings={qualityWarnings}
            partialErrorsByCategory={partialErrorsByCategory}
            fileUploadStatesByCategory={fileUploadStatesByCategory}
            failedFilesByCategory={failedFilesByCategory}
            skippedOptional={skippedOptional}
            visibleTiers={["recommended", "optional"]}
            tierTitleOverrides={extraPhotosTierOverrides}
            expandNonRequiredSections
            onUpload={(category, files) => void uploadFiles(category, files)}
            onDeleted={deleteUpload}
            onRetryCategory={(category) => {
              const failed = failedFilesByCategory[category];
              if (failed?.length) void uploadFiles(category, failed, true);
            }}
            onRetryFile={(category, file) => void uploadFiles(category, [file], true)}
            onDeleteError={(msg) => showToast(patientError(msg))}
            onSkipOptional={toggleSkippedOptional}
          />
          <div className="border-t border-slate-200 pt-4">
            {canContinue ? (
              <Link
                href={questionsHref}
                data-testid="guided-upload-continue"
                className="inline-flex w-full items-center justify-center rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-400 sm:w-auto"
              >
                {continueLabel}
              </Link>
            ) : (
              <span
                data-testid="guided-upload-continue-disabled"
                className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-gray-200 px-4 py-3 text-sm font-semibold text-gray-500 sm:w-auto"
              >
                {continueLabel}
              </span>
            )}
          </div>
        </section>
      ) : null}

      {!showingEncouragement && view.mode === "step" && currentSlotDef ? (
        <div data-testid="guided-upload-step" data-step-key={currentKey}>
          <UploadPhotoCard
            caseId={caseId}
            category={currentKey}
            title={t(currentSlotDef.labelKey as TranslationKey)}
            help={t(currentSlotDef.descriptionKey as TranslationKey)}
            quickTips={currentSlotDef.quickTips}
            slotStatus={resolveSlotStatus(currentKey, currentSlotDef.min)}
            min={currentSlotDef.min}
            max={currentSlotDef.max}
            accept={currentSlotDef.accept}
            existing={currentExisting}
            locked={isLocked}
            showCantProvide={false}
            errorMessage={categoryErrors[currentKey]}
            successMessage={categorySuccess[currentKey]}
            qualityWarning={qualityWarnings[currentKey]}
            partialErrors={partialErrorsByCategory[currentKey]}
            fileUploadStates={fileUploadStatesByCategory[currentKey]}
            failedFiles={failedFilesByCategory[currentKey]}
            onRetry={() => {
              const failed = failedFilesByCategory[currentKey];
              if (failed?.length) void uploadFiles(currentKey, failed, true);
            }}
            onRetryFile={(file) => void uploadFiles(currentKey, [file], true)}
            onUpload={(files) => void uploadFiles(currentKey, files)}
            onDeleted={deleteUpload}
            onDeleteError={(msg) => showToast(patientError(msg))}
            patientCopy
          />
        </div>
      ) : null}

      {view.mode === "step" && !showingEncouragement ? (
        <nav
          className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"
          aria-label="Upload step navigation"
        >
          <div className="flex flex-wrap gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={() => goToStep(stepIndex - 1)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("patient.upload.wizard.back" as TranslationKey)}
              </button>
            ) : (
              <Link
                href={backHref}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("patient.upload.wizard.back" as TranslationKey)}
              </Link>
            )}
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={() => goToStep(stepIndex - 1)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                {t("patient.upload.wizard.reviewPrevious" as TranslationKey)}
              </button>
            ) : null}
          </div>
          {currentStepComplete && currentExisting.length > 0 ? (
            <button
              type="button"
              onClick={() => void replaceCurrentPhoto()}
              disabled={isLocked || replaceBusy || busyCats[currentKey]}
              className="rounded-md px-3 py-2 text-sm font-medium text-sky-700 hover:text-sky-900 disabled:opacity-50"
            >
              {t("patient.upload.wizard.replacePhoto" as TranslationKey)}
            </button>
          ) : null}
        </nav>
      ) : null}

      <UploadErrorToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
