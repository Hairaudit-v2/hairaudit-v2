// src/lib/photoCategories.ts
// Patient Photos – Basic Audit requirements (8 required categories)
import { z } from "zod";
import {
  PATIENT_UPLOAD_CATEGORY_DEFS,
  type PatientUploadCategoryKey,
} from "./patientPhotoCategoryConfig";

/** UI / API list shape (unchanged for consumers). */
export const PATIENT_PHOTO_CATEGORIES = PATIENT_UPLOAD_CATEGORY_DEFS.filter(
  (d) => d.visibleInUi
).map((d) => ({
  key: d.key,
  title: d.label,
  required: d.required,
  help: d.description,
  tips: [...d.tips],
  accept: d.accept,
  maxFiles: d.maxFiles,
  minFiles: d.minFiles,
}));

export type PatientPhotoCategory = PatientUploadCategoryKey;

export const PatientPhotoCategorySchema = z.enum(
  PATIENT_UPLOAD_CATEGORY_DEFS.map((c) => c.key) as [PatientPhotoCategory, ...PatientPhotoCategory[]]
);

// Backwards-compatible aliases (for existing uploads with old type names)
export const PATIENT_PHOTO_CATEGORY_ALIASES: Record<string, PatientPhotoCategory> = {
  "preop-front": "preop_front",
  "donor_rear": "preop_donor_rear",
  "donor": "preop_donor_rear",
  "postop": "postop_day0",
};

export function normalizePatientPhotoCategory(input: string): PatientPhotoCategory {
  const trimmed = input.trim();
  const mapped = PATIENT_PHOTO_CATEGORY_ALIASES[trimmed] ?? trimmed;
  return PatientPhotoCategorySchema.parse(mapped);
}

export function photoTypeFromCategory(cat: PatientPhotoCategory) {
  return `patient_photo:${cat}` as const;
}

export function requiredCategoryMinFiles(cat: PatientPhotoCategory): number {
  const def = PATIENT_PHOTO_CATEGORIES.find((c) => c.key === cat);
  return def?.minFiles ?? 0;
}

export const REQUIRED_PATIENT_PHOTO_CATEGORIES = PATIENT_UPLOAD_CATEGORY_DEFS.filter(
  (c) => c.required
).map((c) => c.key) as PatientPhotoCategory[];

/** Resolve raw DB category to canonical; legacy "preop_sides" maps to both left & right */
export function resolveCategoryForValidation(cat: string): PatientPhotoCategory[] {
  const trimmed = cat?.trim?.() ?? "";
  if (!trimmed) return [];
  const mapped = PATIENT_PHOTO_CATEGORY_ALIASES[trimmed] ?? trimmed;
  if (mapped === "preop_left" || mapped === "preop_right") return [mapped];
  if (trimmed === "preop_sides") return ["preop_left", "preop_right"];
  if (PatientPhotoCategorySchema.safeParse(mapped).success) return [mapped as PatientPhotoCategory];
  return [];
}

/** Build effective category counts from upload types (handles aliases + preop_sides) */
export function buildPatientPhotoCategoryCounts(
  uploadTypes: { type: string }[]
): Record<PatientPhotoCategory, number> {
  const prefix = "patient_photo:";
  const counts = {} as Record<PatientPhotoCategory, number>;
  for (const key of REQUIRED_PATIENT_PHOTO_CATEGORIES) {
    counts[key] = 0;
  }
  for (const u of uploadTypes) {
    if (!u.type?.startsWith(prefix)) continue;
    const raw = u.type.slice(prefix.length);
    const resolved = resolveCategoryForValidation(raw);
    for (const r of resolved) {
      if (r in counts) counts[r as PatientPhotoCategory]++;
    }
  }
  return counts;
}

/** Returns list of missing required categories */
export function getMissingRequiredPatientPhotoCategories(
  uploadTypes: { type: string }[]
): PatientPhotoCategory[] {
  const counts = buildPatientPhotoCategoryCounts(uploadTypes);
  return REQUIRED_PATIENT_PHOTO_CATEGORIES.filter((cat) => (counts[cat] ?? 0) === 0);
}
