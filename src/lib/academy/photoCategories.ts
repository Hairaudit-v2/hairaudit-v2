import {
  ACADEMY_OPTIONAL_PHOTO_CATEGORIES,
  ACADEMY_REQUIRED_PHOTO_CATEGORIES,
  TRAINING_PHOTO_PREFIX,
  type AcademyPhotoCategory,
} from "./constants";

const ALL = new Set<string>([
  ...ACADEMY_REQUIRED_PHOTO_CATEGORIES,
  ...ACADEMY_OPTIONAL_PHOTO_CATEGORIES,
]);

export function trainingPhotoType(category: AcademyPhotoCategory): string {
  return `${TRAINING_PHOTO_PREFIX}${category}`;
}

/** Parse `training_photo:category` → category key, or null if invalid */
export function parseTrainingPhotoType(type: string): AcademyPhotoCategory | null {
  if (typeof type !== "string" || !type.startsWith(TRAINING_PHOTO_PREFIX)) return null;
  const cat = type.slice(TRAINING_PHOTO_PREFIX.length);
  if (!ALL.has(cat)) return null;
  return cat as AcademyPhotoCategory;
}

export function isAcademyPhotoCategory(value: string): value is AcademyPhotoCategory {
  return ALL.has(value);
}

export function normalizeAcademyPhotoCategoryInput(raw: string): AcademyPhotoCategory | null {
  const t = raw.trim().toLowerCase();
  return isAcademyPhotoCategory(t) ? t : null;
}
