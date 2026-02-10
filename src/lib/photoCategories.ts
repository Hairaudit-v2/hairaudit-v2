// src/lib/photoCategories.ts
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
    key: "preop_sides",
    title: "Pre-op — Sides (Left & Right)",
    required: true,
    help: "Both temple angles / side profile views.",
    tips: ["One photo left side, one right side", "Keep background plain"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 2, // IMPORTANT: enforce 2 for "sides"
  },
  {
    key: "donor_rear",
    title: "Donor Area — Rear & Sides",
    required: true,
    help: "Back of head and donor zone coverage.",
    tips: ["Include whole donor region", "Add one close-up if possible"],
    accept: "image/*",
    maxFiles: 5,
    minFiles: 1,
  },
  {
    key: "preop_crown",
    title: "Pre-op — Crown (Optional)",
    required: false,
    help: "Top-down crown view if crown is involved.",
    tips: ["Take from above head", "Use mirror or helper if needed"],
    accept: "image/*",
    maxFiles: 3,
    minFiles: 0,
  },
  {
    key: "intraop",
    title: "Intra-op (Optional)",
    required: false,
    help: "Any photos taken during surgery (if available).",
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

// Backwards-compatible aliases (add whatever your API/DB currently expects)
export const PATIENT_PHOTO_CATEGORY_ALIASES: Record<string, PatientPhotoCategory> = {
  // if old UI sent these:
  "preop-front": "preop_front",
  // if backend expects different names:
  "preop_left": "preop_sides",
  "preop_right": "preop_sides",
  "donor": "donor_rear",
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
