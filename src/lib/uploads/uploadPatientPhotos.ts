/**
 * Shared patient photo upload orchestration — compression, progress, partial API errors.
 */

import { compressPatientPhoto } from "@/lib/uploads/compressPatientPhoto";
import {
  appendPatientUploadMetadata,
  formatPatientUploadError,
} from "@/lib/uploads/patientUploadClient";
import { getPatientUploadConfidenceMessage } from "@/lib/uploads/patientUploadConfidenceMessages";
import { toPatientFacingUploadError } from "@/lib/uploads/patientUploadClient";
import { uploadFormDataWithProgress } from "@/lib/uploads/uploadWithProgress";
import { MAX_CONCURRENT_UPLOADS } from "@/lib/uploads/uploadLimits";
import type { SubmitterType } from "@/lib/auditPhotoSchemas";

export type PerFileUploadState = {
  id: string;
  fileName: string;
  progress: number;
  phase: "compressing" | "uploading" | "complete" | "failed";
  error?: string;
};

export type CategoryUploadResult = {
  saved: Array<{
    id: string;
    type: string;
    storage_path: string;
    metadata: unknown;
    created_at: string;
  }>;
  successCount: number;
  failedFiles: File[];
  partialErrors: Array<{ file: string; error: string }>;
  confidenceMessage: string | null;
  qualityWarning: string | null;
};

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function uploadPatientPhotoFiles(params: {
  caseId: string;
  category: string;
  files: File[];
  submitterType: SubmitterType;
  onFileStateChange?: (states: PerFileUploadState[]) => void;
}): Promise<CategoryUploadResult> {
  const { caseId, category, files, submitterType, onFileStateChange } = params;

  const states: PerFileUploadState[] = files.map((f) => ({
    id: fileKey(f),
    fileName: f.name,
    progress: 0,
    phase: "compressing",
  }));

  const emit = () => onFileStateChange?.([...states]);

  emit();

  const saved: CategoryUploadResult["saved"] = [];
  const failedFiles: File[] = [];
  const partialErrors: Array<{ file: string; error: string }> = [];
  let successCount = 0;
  let qualityWarning: string | null = null;

  await runWithConcurrency(files, MAX_CONCURRENT_UPLOADS, async (original, index) => {
    const state = states[index];
    state.phase = "compressing";
    state.progress = 5;
    emit();

    try {
      const { file, meta } = await compressPatientPhoto(original);
      if (meta.qualityWarning) qualityWarning = meta.qualityWarning;
      state.phase = "uploading";
      state.progress = 10;
      emit();

      const fd = new FormData();
      fd.append("caseId", caseId);
      fd.append("submitterType", submitterType);
      fd.append("category", category);
      fd.append("files[]", file);
      appendPatientUploadMetadata(fd, meta);

      const { ok, json } = await uploadFormDataWithProgress(
        "/api/uploads/audit-photos",
        fd,
        (pct) => {
          state.progress = Math.max(state.progress, 10 + Math.round(pct * 0.85));
          emit();
        }
      );

      if (!ok) {
        const formatted = formatPatientUploadError(json);
        throw new Error(
          submitterType === "patient"
            ? toPatientFacingUploadError(formatted.message)
            : formatted.message
        );
      }

      if (json.errors?.length) {
        for (const err of json.errors) {
          const errText = err.error ?? "Upload failed";
          partialErrors.push({
            file: err.file ?? original.name,
            error:
              submitterType === "patient" ? toPatientFacingUploadError(errText) : errText,
          });
        }
      }

      if (json.saved?.length) {
        saved.push(...(json.saved as CategoryUploadResult["saved"]));
        successCount++;
        state.phase = "complete";
        state.progress = 100;
        emit();
      } else if (json.errors?.length) {
        const match =
          json.errors.find((e) => e.file === original.name) ?? json.errors[0];
        const matchErr = match?.error ?? "Upload failed";
        throw new Error(
          submitterType === "patient" ? toPatientFacingUploadError(matchErr) : matchErr
        );
      } else {
        throw new Error("Upload did not save any files");
      }
    } catch (e: unknown) {
      const raw = (e as Error)?.message ?? "Upload failed";
      const msg = submitterType === "patient" ? toPatientFacingUploadError(raw) : raw;
      state.phase = "failed";
      state.error = msg;
      state.progress = 0;
      failedFiles.push(original);
      partialErrors.push({ file: original.name, error: msg });
      emit();
    }
  });

  return {
    saved,
    successCount,
    failedFiles,
    partialErrors,
    confidenceMessage:
      successCount > 0 ? getPatientUploadConfidenceMessage(category) : null,
    qualityWarning,
  };
}
