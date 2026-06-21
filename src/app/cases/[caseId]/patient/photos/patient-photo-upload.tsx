"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  PATIENT_PHOTO_CATEGORIES,
  PatientPhotoCategory,
} from "@/lib/photoCategories";
import ExtendedPatientPhotoUploadGroups from "@/components/patient/ExtendedPatientPhotoUploadGroups";
import PatientImageEvidenceNudgeCallout from "@/components/patient/PatientImageEvidenceNudgeCallout";
import { computePatientImageEvidenceQualityFromCaseUploads } from "@/lib/audit/patientImageEvidenceConfidence";
import { buildPatientImageEvidenceUploadNudges } from "@/lib/audit/patientImageEvidenceUploadNudges";
import { isPatientImageEvidenceNudgesEnabled } from "@/lib/features/enablePatientImageEvidenceNudges";
import type { PatientPhotoUploadGuidancePanel } from "@/lib/patientPhoto/patientPhotoUploadGuidance";
import { caseSubmitSurfaceOpen } from "@/lib/patient/caseSubmitStatus";
import UploadPhotoCard, { type PhotoSlotStatus } from "@/components/patient/upload/UploadPhotoCard";
import UploadErrorToast, { type UploadToast } from "@/components/patient/upload/UploadErrorToast";
import {
  uploadPatientPhotoFiles,
  type PerFileUploadState,
} from "@/lib/uploads/uploadPatientPhotos";

const PATIENT_PHOTO_SECTIONS: {
  heading: string;
  sub: string;
  keys: readonly PatientPhotoCategory[];
}[] = [
  {
    heading: "Before Surgery — Main angles (Required)",
    sub: "Photos taken before your transplant: front, top, and back of head.",
    keys: ["preop_front", "preop_top", "preop_donor_rear"],
  },
  {
    heading: "Before Surgery Photos (Optional)",
    sub: "Left, right, and crown angles help strengthen your review.",
    keys: ["preop_left", "preop_right", "preop_crown"],
  },
  {
    heading: "After Surgery / Progress Photos (Optional)",
    sub: "Surgery-day and early healing photos when you have them.",
    keys: ["day0_recipient", "day0_donor", "intraop", "postop_day0"],
  },
];

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: unknown;
  created_at: string;
};

function categoryFromType(type: string): PatientPhotoCategory | null {
  const prefix = "patient_photo:";
  if (!type?.startsWith(prefix)) return null;
  return type.slice(prefix.length) as PatientPhotoCategory;
}

function resolveSlotStatus(
  required: boolean,
  minFiles: number,
  existingCount: number,
  busy: boolean,
  failedCount: number
): PhotoSlotStatus {
  if (busy) return "uploading";
  if (failedCount > 0) return "needs_retry";
  if (existingCount >= minFiles && existingCount > 0) return "complete";
  if (required) return "required";
  return "optional";
}

export default function PatientPhotoUpload({
  caseId,
  initialUploads,
  caseStatus,
  submittedAt,
  patientPhotoStageGuidance,
}: {
  caseId: string;
  initialUploads: UploadRow[];
  caseStatus: string;
  submittedAt?: string | null;
  patientPhotoStageGuidance?: PatientPhotoUploadGuidancePanel | null;
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

  const isLocked = !caseSubmitSurfaceOpen({ status: caseStatus, submitted_at: submittedAt });

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

  const categoryByKey = useMemo(() => {
    const m = new Map<PatientPhotoCategory, (typeof PATIENT_PHOTO_CATEGORIES)[number]>();
    for (const c of PATIENT_PHOTO_CATEGORIES) m.set(c.key, c);
    return m;
  }, []);

  function showToast(message: string, variant: UploadToast["variant"] = "error") {
    setToast({ id: `${Date.now()}`, message, variant });
  }

  async function uploadFiles(category: PatientPhotoCategory, files: File[], isRetry = false) {
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
        setUploads((prev) => [...result.saved, ...prev]);
        if (result.qualityWarning) {
          setQualityWarnings((p) => ({ ...p, [category]: result.qualityWarning! }));
        }
      }

      if (result.confidenceMessage) {
        setCategorySuccess((p) => ({ ...p, [category]: result.confidenceMessage! }));
        showToast(result.confidenceMessage, "success");
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
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Upload Patient Photos</h1>
        <p className="text-sm text-slate-700">
          Upload clear photos in good lighting. Your progress saves automatically — you can return
          anytime before submitting.
        </p>

        {isLocked ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <b>Case submitted.</b> Photos are locked to preserve review integrity.
          </div>
        ) : null}
      </header>

      {evidenceNudges.length > 0 ? <PatientImageEvidenceNudgeCallout nudges={evidenceNudges} /> : null}

      {patientPhotoStageGuidance ? (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50/90 p-4 text-sm text-slate-900"
          role="note"
        >
          <p className="font-semibold">{patientPhotoStageGuidance.title}</p>
          <p className="mt-1 leading-relaxed text-slate-700">{patientPhotoStageGuidance.body}</p>
        </div>
      ) : null}

      <div className="space-y-8">
        {PATIENT_PHOTO_SECTIONS.map((section, sIdx) => (
          <div
            key={section.heading}
            className={`space-y-4 ${sIdx > 0 ? "border-t border-slate-200 pt-6" : ""}`}
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">{section.heading}</h2>
              <p className="text-sm text-slate-600">{section.sub}</p>
            </div>
            <div className="space-y-4">
              {section.keys.map((key) => {
                const cat = categoryByKey.get(key);
                if (!cat) return null;
                const existing = uploadsByCategory[cat.key] ?? [];
                const failedCount = failedFilesByCategory[cat.key]?.length ?? 0;
                return (
                  <UploadPhotoCard
                    key={cat.key}
                    caseId={caseId}
                    category={cat.key}
                    title={cat.title}
                    help={cat.help}
                    quickTips={cat.tips}
                    slotStatus={resolveSlotStatus(
                      cat.required,
                      1,
                      existing.length,
                      !!busyCats[cat.key],
                      failedCount
                    )}
                    min={1}
                    max={cat.maxFiles}
                    accept={cat.accept}
                    existing={existing}
                    locked={isLocked}
                    errorMessage={categoryErrors[cat.key]}
                    successMessage={categorySuccess[cat.key]}
                    qualityWarning={qualityWarnings[cat.key]}
                    partialErrors={partialErrorsByCategory[cat.key]}
                    fileUploadStates={fileUploadStatesByCategory[cat.key]}
                    failedFiles={failedFilesByCategory[cat.key]}
                    onRetry={() => {
                      const failed = failedFilesByCategory[cat.key];
                      if (failed?.length) void uploadFiles(cat.key, failed, true);
                    }}
                    onRetryFile={(file) => void uploadFiles(cat.key, [file], true)}
                    onUpload={(files) => uploadFiles(cat.key, files)}
                    onDeleted={deleteUpload}
                    onDeleteError={(msg) => showToast(msg)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <ExtendedPatientPhotoUploadGroups
        locked={isLocked}
        busyCats={busyCats}
        uploadsByCategory={uploadsByCategory}
        onUpload={uploadFiles}
        onDeleted={deleteUpload}
        skin="legacy"
        caseId={caseId}
        extendedGroupOrderHint={patientPhotoStageGuidance?.extendedGroupOrderHint}
        categoryErrors={categoryErrors}
        categorySuccess={categorySuccess}
        qualityWarnings={qualityWarnings}
        partialErrorsByCategory={partialErrorsByCategory}
        fileUploadStatesByCategory={fileUploadStatesByCategory}
        failedFilesByCategory={failedFilesByCategory}
        onRetryCategory={(cat) => {
          const failed = failedFilesByCategory[cat];
          if (failed?.length) void uploadFiles(cat as PatientPhotoCategory, failed, true);
        }}
        onRetryFile={(cat, file) => void uploadFiles(cat as PatientPhotoCategory, [file], true)}
        onDeleteError={(msg) => showToast(msg)}
      />

      <footer className="flex items-center justify-between border-t pt-3 text-sm">
        <span>
          {isLocked
            ? "Case submitted — photos locked"
            : requiredOk
              ? "Required photos complete"
              : "Upload required photos to continue"}
        </span>

        <div className="flex items-center gap-3">
          <Link
            href={`/cases/${caseId}/patient/questions`}
            className="text-slate-600 hover:text-slate-900"
          >
            Continue to questions
          </Link>
          <Link
            href={`/cases/${caseId}`}
            className={`rounded-md px-4 py-2 font-medium ${
              requiredOk && !isLocked
                ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                : "cursor-not-allowed bg-gray-200 text-gray-500 pointer-events-none"
            }`}
          >
            Submit for review
          </Link>
        </div>
      </footer>

      <UploadErrorToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
