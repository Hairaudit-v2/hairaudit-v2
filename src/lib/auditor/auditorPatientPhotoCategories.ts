import { PATIENT_AUDIT_PHOTO_BUCKET_DEFS, PATIENT_UPLOAD_CATEGORY_DEFS } from "@/lib/patientPhotoCategoryConfig";
import { normalizePatientPhotoCategory, PATIENT_PHOTO_CATEGORY_ALIASES } from "@/lib/photoCategories";

const REASSIGNABLE_SET = new Set<string>([
  ...PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => d.key),
  ...PATIENT_AUDIT_PHOTO_BUCKET_DEFS.map((d) => d.key),
]);

/** Sorted unique keys auditors may assign (upload `patient_photo:{key}` suffixes). */
export const AUDITOR_REASSIGNABLE_CATEGORY_KEYS: readonly string[] = Array.from(REASSIGNABLE_SET).sort((a, b) =>
  a.localeCompare(b)
);

export function auditorPatientPhotoCategoryLabel(key: string): string {
  const u = PATIENT_UPLOAD_CATEGORY_DEFS.find((d) => d.key === key);
  if (u) return u.label;
  const b = PATIENT_AUDIT_PHOTO_BUCKET_DEFS.find((d) => d.key === key);
  if (b) return b.title;
  return key.replace(/_/g, " ");
}

/**
 * Normalize auditor-selected category to a valid `patient_photo:` suffix.
 * Accepts all upload-def keys, audit-bucket keys (e.g. patient_current_front, any_preop), and patient API aliases.
 */
export function normalizeAuditorPatientPhotoCategory(input: string): string {
  const trimmed = input.trim();
  const mapped = (PATIENT_PHOTO_CATEGORY_ALIASES as Record<string, string>)[trimmed] ?? trimmed;
  if (REASSIGNABLE_SET.has(mapped)) return mapped;
  return normalizePatientPhotoCategory(mapped);
}
