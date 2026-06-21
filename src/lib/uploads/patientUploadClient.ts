/**
 * Client-side helpers for patient photo upload flows.
 * Mirrors surgery-upload compression + friendly error formatting.
 */

import { prepareImageForUpload, type PreparedImageMeta } from "@/lib/uploads/compressImage";
import { formatUploadErrorForUser, type UploadErrorCode } from "@/lib/uploads/safeUpload";

export const PATIENT_UPLOAD_COMPRESS_OPTS = {
  maxEdge: 2400,
  quality: 0.85,
  skipBelowBytes: 1_200_000,
} as const;

export const PATIENT_UPLOAD_SAVE_LATER_MESSAGE =
  "Your photos save automatically as you upload them. You can leave and come back anytime before submitting your case.";

export const PATIENT_REQUIRED_VIEWS_COPY = {
  title: "Required photos (3 minimum)",
  body: "Please upload clear photos of: front view, top/crown view, and back of head (donor area). Extra angles help but are optional.",
  slots: [
    { label: "Front", hint: "Face the camera, show your hairline" },
    { label: "Top / crown", hint: "Photo from above your head" },
    { label: "Back / donor", hint: "Back of head where grafts were taken" },
  ],
} as const;

export type PatientUploadCategoryError = {
  message: string;
  retryable: boolean;
  failedFiles: string[];
};

export function formatPatientUploadError(json: {
  error?: string;
  code?: string;
  errors?: Array<{ file?: string; error?: string; code?: string }>;
}): PatientUploadCategoryError {
  const code = (json.code ?? json.errors?.[0]?.code ?? "UNKNOWN_ERROR") as UploadErrorCode;
  const rawMessage = json.error ?? json.errors?.[0]?.error;
  const message = rawMessage
    ? formatUploadErrorForUser({
        code,
        message: rawMessage,
        retryable: code === "STORAGE_ERROR" || code === "DB_ERROR" || code === "NETWORK_ERROR",
      })
    : formatUploadErrorForUser({ code, message: "Upload failed", retryable: false });

  const failedFiles = (json.errors ?? [])
    .map((e) => e.file)
    .filter((f): f is string => typeof f === "string" && f.length > 0);

  return {
    message,
    retryable: code === "STORAGE_ERROR" || code === "DB_ERROR" || code === "NETWORK_ERROR" || code === "RATE_LIMITED",
    failedFiles,
  };
}

export type PreparedPatientUpload = {
  file: File;
  meta: PreparedImageMeta;
};

export async function preparePatientUploadFile(file: File): Promise<PreparedPatientUpload> {
  const { file: prepared, meta } = await prepareImageForUpload(file, PATIENT_UPLOAD_COMPRESS_OPTS);
  return { file: prepared, meta };
}

export function appendPatientUploadMetadata(fd: FormData, meta: PreparedImageMeta): void {
  fd.append("originalFilename", meta.originalFilename);
  fd.append("originalSizeBytes", String(meta.originalSizeBytes));
  fd.append("compressedSizeBytes", String(meta.compressedSizeBytes));
  if (meta.width != null) fd.append("width", String(meta.width));
  if (meta.height != null) fd.append("height", String(meta.height));
  fd.append("compressionApplied", String(meta.compressionApplied));
  if (meta.qualityWarning) fd.append("qualityWarning", meta.qualityWarning);
}

/** Map raw upload errors to calm patient-facing copy (English fallback for non-React callers). */
export function toPatientFacingUploadError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("unsupported") ||
    lower.includes("not allowed") ||
    lower.includes("valid image") ||
    lower.includes("jpeg, png")
  ) {
    return "Please choose a photo from your phone or computer.";
  }
  if (lower.includes("compress") || lower.includes("processing")) {
    return "We had trouble processing that photo. Please try again.";
  }
  if (lower.includes("upload failed") || lower.includes("did not save")) {
    return "That photo did not upload properly. Please try again.";
  }
  return raw;
}

export function computeRequiredUploadProgress(
  requiredKeys: readonly string[],
  completed: Set<string>
): { completed: number; total: number; percent: number } {
  const total = requiredKeys.length;
  const done = requiredKeys.filter((k) => completed.has(k)).length;
  return {
    completed: done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}
