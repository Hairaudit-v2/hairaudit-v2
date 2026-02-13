// src/lib/photoCategories.ts
// Patient Photos – Basic Audit requirements (8 required categories)
import { z } from "zod";

export const PATIENT_PHOTO_CATEGORIES = [
  {
    key: "preop_front",
    title: "Pre-op — Front",
    required: true,
    help: "Front-facing scalp/hairline in good lighting.",
    tips: ["Stand under bright indoor light", "Hold camera at eye level", "No filters"],
    accept: "image/*",
    maxFiles: 3,
    minFiles: 1,
  },
  {
    key: "preop_left",
    title: "Pre-op — Left side",
    required: true,
    help: "Left temple / side profile view.",
    tips: ["Keep background plain", "Good lighting"],
    accept: "image/*",
    maxFiles: 2,
    minFiles: 1,
  },
  {
    key: "preop_right",
    title: "Pre-op — Right side",
    required: true,
    help: "Right temple / side profile view.",
    tips: ["Keep background plain", "Good lighting"],
    accept: "image/*",
    maxFiles: 2,
    minFiles: 1,
  },
  {
    key: "preop_top",
    title: "Pre-op — Top",
    required: true,
    help: "Top-down view of scalp.",
    tips: ["Take from above head", "Use mirror or helper if needed"],
    accept: "image/*",
    maxFiles: 3,
    minFiles: 1,
  },
  {
    key: "preop_crown",
    title: "Pre-op — Crown",
    required: true,
    help: "Crown area coverage.",
    tips: ["Include crown region if involved in procedure"],
    accept: "image/*",
    maxFiles: 3,
    minFiles: 1,
  },
  {
    key: "preop_donor_rear",
    title: "Pre-op — Donor (rear)",
    required: true,
    help: "Back of head and donor zone coverage.",
    tips: ["Include whole donor region", "Add one close-up if possible"],
    accept: "image/*",
    maxFiles: 5,
    minFiles: 1,
  },
  {
    key: "day0_recipient",
    title: "Day-of surgery — Recipient",
    required: true,
    help: "Recipient area (day of procedure or day after is fine).",
    tips: ["Clear view of graft placement"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 1,
  },
  {
    key: "day0_donor",
    title: "Day-of surgery — Donor",
    required: true,
    help: "Donor area (day of procedure or day after is fine).",
    tips: ["Shows extraction sites"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 1,
  },
  {
    key: "intraop",
    title: "Intra-op (Optional)",
    required: false,
    help: "Any additional photos taken during surgery.",
    tips: ["Include graft placement close-ups if you have them"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "postop_day0",
    title: "Post-op Day 0–3 (Optional)",
    required: false,
    help: "Immediate post-op healing photos.",
    tips: ["Good for verifying placement + early healing"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
] as const;

export type PatientPhotoCategory = (typeof PATIENT_PHOTO_CATEGORIES)[number]["key"];

export const PatientPhotoCategorySchema = z.enum(
  PATIENT_PHOTO_CATEGORIES.map((c) => c.key) as [
    PatientPhotoCategory,
    ...PatientPhotoCategory[]
  ]
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

export const REQUIRED_PATIENT_PHOTO_CATEGORIES = PATIENT_PHOTO_CATEGORIES
  .filter((c) => c.required)
  .map((c) => c.key) as PatientPhotoCategory[];

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
