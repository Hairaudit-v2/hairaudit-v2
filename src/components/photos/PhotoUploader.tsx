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
import EvidenceUploadGuidancePanel from "@/components/patient/EvidenceUploadGuidancePanel";
import { evaluateEvidence, type CasePhotoInput } from "@/lib/evidence/evidenceEvaluator";
import { getUploadHighlightKeys } from "@/lib/evidence/evidenceUploadUiHints";
import { caseSubmitSurfaceOpen } from "@/lib/patient/caseSubmitStatus";
import {
  DEFAULT_PATIENT_REVIEW_PATHWAY,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import type { PatientPhotoUploadGuidancePanel } from "@/lib/patientPhoto/patientPhotoUploadGuidance";
import GuidedPatientUploadWizard from "@/components/patient/upload/GuidedPatientUploadWizard";
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

type ProfessionalSubmitterType = Exclude<SubmitterType, "patient">;

function categoryFromType(type: string, prefix: string): string | null {
  if (!type?.startsWith(`${prefix}:`)) return null;
  return type.slice(prefix.length + 1);
}

function ProfessionalPhotoUploader({
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
  submitterType: ProfessionalSubmitterType;
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

  const toggleSkipped = (key: string) => {
    if (schema.find((c) => c.key === key)?.required) return;
    setSkippedOptional((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const portalLabel = submitterType === "doctor" ? "Doctor" : "Clinic";

  return (
    <div data-testid="upload-evidence-pack" className="mx-auto max-w-3xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-semibold">{portalLabel} Photo Uploads</h1>
        <p className="mt-1 text-sm text-gray-600">
          {submitterType === "doctor"
            ? "Upload the required standardized photo set for best audit quality."
            : "Upload the required photo set for this case."}
        </p>

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
              {score}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-600">Review confidence:</span>{" "}
            <span className="text-sm font-medium">{confidence}</span>
          </div>
          {missingRequired.length > 0 && (
            <div className="text-sm text-amber-700">
              Still needed: {missingRequired.join(", ")}
            </div>
          )}
        </div>

        {isLocked && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            Case submitted. Photos are locked.
          </div>
        )}

        {evidenceUi ? (
          <div className="mt-4">
            <EvidenceUploadGuidancePanel result={evidenceUi.result} />
          </div>
        ) : null}
      </header>

      <div className="space-y-4">
        {schema.map((def) => {
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
              showCantProvide={false}
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
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Review Summary</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {schema.map((def) => {
            const count = uploadsByCategory[def.key]?.length ?? 0;
            const ok = def.min > 0 ? count >= def.min : count > 0;
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
          ) : canProceed && !isLocked ? (
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
          )}
        </footer>
      )}
      <UploadErrorToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
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
  patientPhotoStageGuidance: _patientPhotoStageGuidance,
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
  /** Intake-driven guidance — patient wizard only (HA-UX-6C may surface optional tiers). */
  patientPhotoStageGuidance?: PatientPhotoUploadGuidancePanel | null;
  /** HA-DUAL-PATHWAY-1 — filters required upload keys for patient cases */
  patientReviewPathway?: PatientReviewPathway;
}) {
  if (submitterType === "patient") {
    return (
      <GuidedPatientUploadWizard
        caseId={caseId}
        initialUploads={initialUploads}
        caseStatus={caseStatus}
        submittedAt={submittedAt}
        patientReviewPathway={patientReviewPathway}
        backHref={backHref}
        questionsHref={nextHref ?? `/cases/${caseId}/patient/questions`}
      />
    );
  }

  return (
    <ProfessionalPhotoUploader
      caseId={caseId}
      submitterType={submitterType}
      initialUploads={initialUploads}
      caseStatus={caseStatus}
      submittedAt={submittedAt}
      backHref={backHref}
      nextHref={nextHref}
      nextLabel={nextLabel}
      hideFooter={hideFooter}
    />
  );
}
