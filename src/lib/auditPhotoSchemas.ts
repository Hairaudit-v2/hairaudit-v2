// Dual-schema photo upload: Doctor/Clinic (gold standard) vs Patient (realistic)
// Evidence scoring: A/B/C/D + confidence labels
// Schema definitions (with copy) come from photoSchemas.ts

import { z } from "zod";
import { PATIENT_PHOTO_SCHEMA as PATIENT_SCHEMA, DOCTOR_PHOTO_SCHEMA as DOCTOR_SCHEMA } from "./photoSchemas";

export type SubmitterType = "doctor" | "patient" | "clinic";

export const SUBMITTER_TYPES = ["doctor", "patient", "clinic"] as const;
export const SubmitterTypeSchema = z.enum(SUBMITTER_TYPES);

export type EvidenceScore = "A" | "B" | "C" | "D";
export type ConfidenceLabel = "High" | "Medium" | "Low" | "Very Low";

/* ----- Re-export schemas (single source of truth from photoSchemas) ----- */

export const DOCTOR_REQUIRED_KEYS = [
  "img_preop_front",
  "img_preop_left",
  "img_preop_right",
  "img_preop_top",
  "img_preop_donor_rear",
  "img_immediate_postop_recipient",
  "img_immediate_postop_donor",
] as const;

export const DOCTOR_OPTIONAL_KEYS = [
  "img_preop_crown",
  "img_preop_donor_sides",
  "img_marking_design",
  "img_intraop_extraction",
  "img_graft_inspection",
  "img_graft_tray_overview",
  "img_graft_tray_closeup",
  "img_graft_microscopy",
  "img_site_creation",
  "img_implantation_stage",
  "img_followup_front",
  "img_followup_top",
  "img_followup_crown",
  "img_followup_donor",
  "img_trichoscopy",
  "file_operative_notes",
  "file_case_records",
] as const;

export const DOCTOR_PHOTO_SCHEMA = DOCTOR_SCHEMA;

export type DoctorPhotoKey = (typeof DOCTOR_SCHEMA)[number]["key"];

export const PATIENT_REQUIRED_KEYS = [
  "patient_current_front",
  "patient_current_top",
  "patient_current_donor_rear",
] as const;

export const PATIENT_OPTIONAL_KEYS = [
  "patient_current_left", "patient_current_right", "patient_current_crown",
  "any_preop", "any_day0", "any_early_postop_day0_3",
] as const;

export const PATIENT_ADDITIONAL_FOR_GRADE = [...PATIENT_OPTIONAL_KEYS] as const;

export const PATIENT_PHOTO_SCHEMA = PATIENT_SCHEMA;

export type PatientPhotoKey = (typeof PATIENT_SCHEMA)[number]["key"];

/* ----- Photo record shape ----- */

export type PhotoRecord = {
  photo_key: string;
  submitter_type?: SubmitterType;
  storage_path?: string;
};

/** From uploads.type (patient_photo:X, doctor_photo:X, or clinic_photo:X) or audit_photos rows */
export function parsePhotoKey(typeOrRow: string | { type?: string } | { photo_key: string; submitter_type?: string }): { submitterType: SubmitterType; key: string } | null {
  if (typeof typeOrRow === "object") {
    if ("photo_key" in typeOrRow && typeOrRow.photo_key) {
      const st = typeOrRow.submitter_type as SubmitterType | undefined;
      return st ? { submitterType: st, key: typeOrRow.photo_key } : null;
    }
    const t = "type" in typeOrRow ? (typeOrRow.type ?? "") : "";
    if (t.startsWith("patient_photo:"))
      return { submitterType: "patient", key: t.slice("patient_photo:".length) };
    if (t.startsWith("doctor_photo:"))
      return { submitterType: "doctor", key: t.slice("doctor_photo:".length) };
    if (t.startsWith("clinic_photo:"))
      return { submitterType: "clinic", key: t.slice("clinic_photo:".length) };
    return null;
  }
  const t = String(typeOrRow ?? "");
  if (t.startsWith("patient_photo:")) return { submitterType: "patient", key: t.slice("patient_photo:".length) };
  if (t.startsWith("doctor_photo:")) return { submitterType: "doctor", key: t.slice("doctor_photo:".length) };
  if (t.startsWith("clinic_photo:")) return { submitterType: "clinic", key: t.slice("clinic_photo:".length) };
  return null;
}

/** Legacy patient keys -> new patient keys mapping */
const PATIENT_LEGACY_MAP: Record<string, PatientPhotoKey | null> = {
  preop_front: "patient_current_front",
  preop_top: "patient_current_top",
  preop_donor_rear: "patient_current_donor_rear",
  donor_rear: "patient_current_donor_rear",
  preop_left: "patient_current_left",
  preop_right: "patient_current_right",
  preop_crown: "patient_current_crown",
  day0_recipient: "any_day0",
  day0_donor: "any_day0",
  intraop: "any_day0",
  postop_day0: "any_early_postop_day0_3",
};

function normalizeToPatientKey(key: string): PatientPhotoKey | null {
  const k = key.trim().toLowerCase();
  const mapped = PATIENT_LEGACY_MAP[k];
  if (mapped) return mapped;
  if (PATIENT_PHOTO_SCHEMA.some((c) => c.key === k)) return k as PatientPhotoKey;
  if (k.startsWith("any_") || k.startsWith("patient_current_")) return k as PatientPhotoKey;
  return null;
}

const DOCTOR_LEGACY_MAP: Record<string, DoctorPhotoKey | null> = {
  pre_procedure: "img_preop_front",
  surgery: "img_intraop_extraction",
  post_procedure: "img_immediate_postop_recipient",
  postop_day0: "img_immediate_postop_recipient",
  preop_front: "img_preop_front",
  preop_left: "img_preop_left",
  preop_right: "img_preop_right",
  preop_top: "img_preop_top",
  preop_crown: "img_preop_crown",
  preop_donor_rear: "img_preop_donor_rear",
  img_graft_tray: "img_graft_tray_closeup",
  day0_recipient: "img_immediate_postop_recipient",
  day0_donor: "img_immediate_postop_donor",
  intraop: "img_intraop_extraction",
  postop_day0_3: "img_immediate_postop_recipient",
};

function normalizeToDoctorKey(key: string): DoctorPhotoKey | null {
  const k = key.trim().toLowerCase();
  const mapped = DOCTOR_LEGACY_MAP[k];
  if (mapped) return mapped;
  if (DOCTOR_PHOTO_SCHEMA.some((c) => c.key === k)) return k as DoctorPhotoKey;
  return null;
}

/** Clinic uses same category schema as doctor (img_* keys). */
function submitterUsesDoctorSchema(st: SubmitterType): boolean {
  return st === "doctor" || st === "clinic";
}

/** Build counts by key for a submitter from photo records */
export function buildCountsByKey(
  photos: Array<{ type?: string; photo_key?: string; submitter_type?: string }>,
  submitterType: SubmitterType
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of photos) {
    const parsed = "photo_key" in p && p.photo_key
      ? { submitterType: (p.submitter_type ?? submitterType) as SubmitterType, key: p.photo_key }
      : parsePhotoKey(p.type ?? "");
    if (!parsed || parsed.submitterType !== submitterType) continue;
    const norm = submitterType === "patient"
      ? normalizeToPatientKey(parsed.key)
      : normalizeToDoctorKey(parsed.key);
    if (norm) counts[norm] = (counts[norm] ?? 0) + 1;
  }
  return counts;
}

/** Set of completed categories (key meets min) */
export function getCompletedCategories(
  submitterType: SubmitterType,
  photos: Array<{ type?: string; photo_key?: string; submitter_type?: string }>
): Set<string> {
  const schema = submitterUsesDoctorSchema(submitterType) ? DOCTOR_PHOTO_SCHEMA : PATIENT_PHOTO_SCHEMA;
  const counts = buildCountsByKey(photos, submitterType);
  const completed = new Set<string>();
  for (const def of schema) {
    const n = counts[def.key] ?? 0;
    if (n >= def.min) completed.add(def.key);
  }
  return completed;
}

/** Compute evidence score A/B/C/D */
export function computeEvidenceScore(
  submitterType: SubmitterType,
  photos: Array<{ type?: string; photo_key?: string; submitter_type?: string }>
): EvidenceScore {
  const completed = getCompletedCategories(submitterType, photos);
  const required = submitterUsesDoctorSchema(submitterType)
    ? [...DOCTOR_REQUIRED_KEYS]
    : [...PATIENT_REQUIRED_KEYS];

  if (submitterUsesDoctorSchema(submitterType)) {
    const missingRequired = required.filter((k) => !completed.has(k));
    if (missingRequired.length === 0) return "A";
    if (missingRequired.length <= 2) return "B";
    const haveCount = required.filter((k) => completed.has(k)).length;
    if (haveCount >= 4) return "C";
    return "D";
  }

  // Patient
  const allRequiredMet = required.every((k) => completed.has(k));
  const additionalKeys = [...PATIENT_ADDITIONAL_FOR_GRADE];
  const additionalCount = additionalKeys.filter((k) => completed.has(k)).length;

  if (!allRequiredMet) {
    const haveCount = required.filter((k) => completed.has(k)).length;
    if (haveCount >= 1) return "C";
    return "D";
  }

  if (additionalCount >= 3) return "A";
  if (additionalCount >= 1) return "B";
  return "C";
}

/** Confidence label from score */
export function computeConfidenceLabel(score: EvidenceScore): ConfidenceLabel {
  const map: Record<EvidenceScore, ConfidenceLabel> = {
    A: "High",
    B: "Medium",
    C: "Low",
    D: "Very Low",
  };
  return map[score];
}

/** Evidence details for storage */
export function computeEvidenceDetails(
  submitterType: SubmitterType,
  photos: Array<{ type?: string; photo_key?: string; submitter_type?: string }>
): {
  submitterType: SubmitterType;
  completedCategories: string[];
  missingRequired: string[];
  countsByKey: Record<string, number>;
  computedAt: string;
} {
  const completed = getCompletedCategories(submitterType, photos);
  const required = submitterUsesDoctorSchema(submitterType)
    ? [...DOCTOR_REQUIRED_KEYS]
    : [...PATIENT_REQUIRED_KEYS];
  const missingRequired = required.filter((k) => !completed.has(k));
  const counts = buildCountsByKey(photos, submitterType);

  return {
    submitterType,
    completedCategories: [...completed],
    missingRequired,
    countsByKey: counts,
    computedAt: new Date().toISOString(),
  };
}

/** Get required keys for a submitter (clinic uses same as doctor) */
export function getRequiredKeys(st: SubmitterType): readonly string[] {
  return submitterUsesDoctorSchema(st) ? DOCTOR_REQUIRED_KEYS : PATIENT_REQUIRED_KEYS;
}

/** Normalize raw key to schema key for display (exported for UI) */
export function normalizeKeyForDisplay(key: string, submitterType: SubmitterType): string | null {
  return submitterType === "patient"
    ? normalizeToPatientKey(key)
    : normalizeToDoctorKey(key);
}

export { submitterUsesDoctorSchema };

/** Check if all required categories are satisfied for submitter */
export function canSubmit(
  submitterType: SubmitterType,
  photos: Array<{ type?: string; photo_key?: string; submitter_type?: string }>
): boolean {
  const completed = getCompletedCategories(submitterType, photos);
  const required = getRequiredKeys(submitterType);
  return required.every((k) => completed.has(k));
}
