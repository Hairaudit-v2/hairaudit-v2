/**
 * Guardrails for patient_photo rows: keep uploads.type and metadata.category aligned,
 * detect drift for debugging, and resolve an effective category key safely.
 */

import { AUDITOR_REASSIGNABLE_CATEGORY_KEYS } from "@/lib/auditor/auditorPatientPhotoCategories";

/** Registered keys (patient upload defs + audit bucket keys) used for integrity classification. */
export const REGISTERED_PATIENT_PHOTO_CATEGORY_KEYS: ReadonlySet<string> = new Set(
  AUDITOR_REASSIGNABLE_CATEGORY_KEYS.map((k) => k.toLowerCase())
);

const SLUG = /^[a-z0-9_]+$/;

export function isRegisteredPatientPhotoCategoryKey(key: string | null | undefined): boolean {
  if (key == null || key === "") return false;
  return REGISTERED_PATIENT_PHOTO_CATEGORY_KEYS.has(String(key).trim().toLowerCase());
}

function parseTypeSuffix(type: string): string | null {
  const t = String(type ?? "").trim();
  const tl = t.toLowerCase();
  if (!tl.startsWith("patient_photo:")) return null;
  const raw = t.slice("patient_photo:".length).trim().toLowerCase();
  if (!raw || !SLUG.test(raw)) return null;
  return raw;
}

function parseMetaCategory(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const c = String((metadata as Record<string, unknown>).category ?? "").trim().toLowerCase();
  if (!c || !SLUG.test(c)) return null;
  return c;
}

export type PatientPhotoCategoryIntegrityReport = {
  typeSuffix: string | null;
  metaCategory: string | null;
  typeSlugValidFormat: boolean;
  metaSlugValidFormat: boolean;
  typeRegistered: boolean;
  metaRegistered: boolean;
  /** Same slug when both sides present and slug-shaped; true if only one side defines category. */
  aligned: boolean;
  /** True if auditors should inspect (drift, invalid combo, or missing alignment). */
  needsAttention: boolean;
  issues: string[];
};

/**
 * Analyze type vs metadata.category for a patient_photo upload (or any row — non-patient yields empty issues).
 */
export function getPatientPhotoCategoryIntegrity(row: {
  type?: string | null;
  metadata?: unknown;
}): PatientPhotoCategoryIntegrityReport {
  const issues: string[] = [];
  const t = String(row.type ?? "").toLowerCase();

  if (!t.startsWith("patient_photo:")) {
    return {
      typeSuffix: null,
      metaCategory: null,
      typeSlugValidFormat: false,
      metaSlugValidFormat: false,
      typeRegistered: false,
      metaRegistered: false,
      aligned: true,
      needsAttention: false,
      issues,
    };
  }

  const typeSuffix = parseTypeSuffix(row.type ?? "");
  const metaCategory = parseMetaCategory(row.metadata);
  const typeSlugValidFormat = typeSuffix != null;
  const metaSlugValidFormat = metaCategory != null;
  const typeRegistered = typeSuffix != null && isRegisteredPatientPhotoCategoryKey(typeSuffix);
  const metaRegistered = metaCategory != null && isRegisteredPatientPhotoCategoryKey(metaCategory);

  const aligned = typeSlugValidFormat && metaSlugValidFormat && typeSuffix === metaCategory;

  if (t.startsWith("patient_photo:") && !typeSlugValidFormat && !metaSlugValidFormat) {
    issues.push("patient_photo row has no valid type suffix and no valid metadata.category slug");
  }

  if (typeSlugValidFormat && metaSlugValidFormat && typeSuffix !== metaCategory) {
    issues.push(`metadata.category (${metaCategory}) does not match type suffix (${typeSuffix})`);
  }

  if (typeSlugValidFormat && !metaSlugValidFormat) {
    const raw = (row.metadata && typeof row.metadata === "object"
      ? String((row.metadata as Record<string, unknown>).category ?? "").trim()
      : "") || "(missing)";
    issues.push(`type suffix is set (${typeSuffix}) but metadata.category is missing or not a valid slug (${raw})`);
  }

  if (!typeSlugValidFormat && metaSlugValidFormat) {
    issues.push(`metadata.category is set (${metaCategory}) but type suffix is missing or not a valid patient_photo key`);
  }

  if (typeSlugValidFormat && !typeRegistered) {
    issues.push(`type suffix "${typeSuffix}" is not in the registered patient photo category list`);
  }

  if (metaSlugValidFormat && !metaRegistered) {
    issues.push(`metadata.category "${metaCategory}" is not in the registered patient photo category list`);
  }

  const needsAttention = issues.length > 0;

  return {
    typeSuffix,
    metaCategory,
    typeSlugValidFormat,
    metaSlugValidFormat,
    typeRegistered,
    metaRegistered,
    aligned,
    needsAttention,
    issues,
  };
}

/**
 * Single write shape for new uploads and category reassignment: always set both type and metadata.category.
 */
export function applyPatientPhotoCategoryFields(
  normalizedCategoryKey: string,
  existingMetadata: Record<string, unknown>
): { type: string; metadata: Record<string, unknown> } {
  const k = normalizedCategoryKey.trim().toLowerCase();
  return {
    type: `patient_photo:${k}`,
    metadata: {
      ...existingMetadata,
      category: k,
    },
  };
}

/**
 * After any metadata mutation, force metadata.category to match the patient_photo type suffix (repair / guard).
 */
export function syncPatientPhotoMetadataCategoryToType(
  type: string,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const tl = String(type ?? "").trim().toLowerCase();
  if (!tl.startsWith("patient_photo:")) return { ...metadata };
  const suffix = String(type ?? "")
    .slice("patient_photo:".length)
    .trim()
    .toLowerCase();
  if (!suffix || !SLUG.test(suffix)) return { ...metadata };
  return { ...metadata, category: suffix };
}

/**
 * Canonical key for pipeline/UI: prefer a well-formed type suffix; otherwise fall back to metadata slug.
 * When both differ, type suffix wins (matches DB column used by most consumers).
 */
export function resolvePatientPhotoCategoryKeyAligned(row: {
  type?: string | null;
  metadata?: unknown;
}): string | null {
  const typeSuffix = parseTypeSuffix(row.type ?? "");
  if (typeSuffix) return typeSuffix;
  return parseMetaCategory(row.metadata);
}

export type PatientPhotoCategoryIntegritySummary = {
  patientPhotoCount: number;
  rowsNeedingAttention: number;
  /** First N problematic rows for quick audit */
  samples: Array<{ uploadId: string; issues: string[] }>;
};

export function summarizePatientPhotoCategoryIntegrity(
  rows: Array<{ id?: string | null; type?: string | null; metadata?: unknown }>,
  sampleLimit = 25
): PatientPhotoCategoryIntegritySummary {
  const patient = rows.filter((r) => String(r.type ?? "").toLowerCase().startsWith("patient_photo:"));
  const flagged = patient.filter((r) => getPatientPhotoCategoryIntegrity(r).needsAttention);
  return {
    patientPhotoCount: patient.length,
    rowsNeedingAttention: flagged.length,
    samples: flagged.slice(0, sampleLimit).map((r) => ({
      uploadId: String(r.id ?? ""),
      issues: [...getPatientPhotoCategoryIntegrity(r).issues],
    })),
  };
}
