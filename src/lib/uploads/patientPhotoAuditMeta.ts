/**
 * Patient photo uploads: audit exclusion and display metadata.
 * Exclusion is stored on `uploads.metadata` so storage_path and type remain recoverable.
 */

import { resolvePatientPhotoCategoryKeyAligned } from "@/lib/uploads/patientPhotoCategoryIntegrity";

export type PatientUploadMetadata = Record<string, unknown> & {
  category?: string;
  original_name?: string;
  display_name?: string;
  audit_excluded?: boolean;
  audit_excluded_at?: string;
  audit_excluded_by?: string;
};

export function isPatientUploadAuditExcluded(row: { type?: string | null; metadata?: unknown }): boolean {
  if (!String(row.type ?? "").startsWith("patient_photo:")) return false;
  const m = row.metadata;
  if (!m || typeof m !== "object") return false;
  return (m as PatientUploadMetadata).audit_excluded === true;
}

/** Drop patient_photo rows marked excluded; leave all other uploads untouched. */
export function filterPatientPhotosForAuditUse<T extends { type?: string | null; metadata?: unknown }>(
  uploads: T[]
): T[] {
  return uploads.filter((u) => !isPatientUploadAuditExcluded(u));
}

/**
 * Effective patient_photo category key for audit/UI and pipelines.
 * Prefers a valid `patient_photo:{key}` type suffix; otherwise metadata.category (see integrity module).
 */
export function effectivePatientPhotoCategoryKey(row: {
  type?: string | null;
  metadata?: unknown;
}): string | null {
  return resolvePatientPhotoCategoryKeyAligned(row);
}

/** Folder segment under `.../patient/{here}/...` in storage — informational only vs effective category. */
export function storagePathPatientCategoryFolder(storagePath: string | null | undefined): string | null {
  const m = String(storagePath ?? "").match(/\/patient\/([^/]+)\//i);
  return m?.[1] ? String(m[1]).toLowerCase() : null;
}

export function displayNameFromPatientUpload(row: {
  type?: string | null;
  metadata?: unknown;
  storage_path?: string | null;
}): string {
  const m = row.metadata;
  if (m && typeof m === "object") {
    const dn = (m as PatientUploadMetadata).display_name;
    if (typeof dn === "string" && dn.trim()) return dn.trim();
    const on = (m as PatientUploadMetadata).original_name;
    if (typeof on === "string" && on.trim()) return on.trim();
  }
  const path = String(row.storage_path ?? "");
  const base = path.split("/").pop() ?? path;
  return base || String(row.type ?? "photo");
}
