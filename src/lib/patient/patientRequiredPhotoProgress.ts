import {
  getCompletedCategories,
  getRequiredKeys,
  type SubmitterType,
} from "@/lib/auditPhotoSchemas";
import { PATIENT_PHOTO_SCHEMA } from "@/lib/photoSchemas";

export type RequiredPhotoProgress = {
  completedCount: number;
  totalRequired: number;
  percent: number;
  missingKeys: string[];
  missingLabels: string[];
  isComplete: boolean;
};

function titleForKey(submitterType: SubmitterType, key: string): string {
  const schema = submitterType === "patient" ? PATIENT_PHOTO_SCHEMA : [];
  return schema.find((d) => d.key === key)?.title ?? key.replace(/_/g, " ");
}

/**
 * Required-category completion for patient dashboard / progress UIs.
 * Counts satisfied required views (front, top, donor) — not raw upload row count.
 */
export function computePatientRequiredPhotoProgress(
  uploads: Array<{ type?: string | null }>
): RequiredPhotoProgress {
  const photos = uploads.map((u) => ({ type: u.type ?? undefined }));
  const completed = getCompletedCategories("patient", photos);
  const required = [...getRequiredKeys("patient")];
  const missingKeys = required.filter((k) => !completed.has(k));
  const completedCount = required.length - missingKeys.length;

  return {
    completedCount,
    totalRequired: required.length,
    percent: required.length > 0 ? Math.round((completedCount / required.length) * 100) : 0,
    missingKeys,
    missingLabels: missingKeys.map((k) => titleForKey("patient", k)),
    isComplete: missingKeys.length === 0,
  };
}
