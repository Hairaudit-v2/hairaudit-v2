// HairAudit Mobile Surgery Upload Portal — Stage 2 clinic defaults model
import {
  sanitizeSurgeryChecklistConfig,
  type SurgeryChecklistConfig,
} from "./checklist";

export type SurgeryUploadClinicDefaults = {
  id: string;
  clinic_profile_id: string;
  default_extraction_machine: string | null;
  default_punch_type: string | null;
  default_punch_size: string | null;
  default_implantation_method: string | null;
  default_prp_used: boolean | null;
  default_exosomes_used: boolean | null;
  default_storage_solution: string | null;
  default_notes: string | null;
  default_photo_checklist_config: unknown | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Default column -> per-case surgery_upload_details column mapping. */
export const DEFAULT_TO_CASE_FIELD: Record<string, string> = {
  default_extraction_machine: "extraction_machine",
  default_punch_type: "punch_type",
  default_punch_size: "punch_size",
  default_implantation_method: "implantation_method",
  default_prp_used: "prp_used",
  default_exosomes_used: "exosomes_used",
  default_storage_solution: "storage_solution",
  default_notes: "notes",
};

export const SURGERY_DEFAULT_TEXT_FIELDS = [
  "default_extraction_machine",
  "default_punch_type",
  "default_punch_size",
  "default_implantation_method",
  "default_storage_solution",
  "default_notes",
] as const;

export const SURGERY_DEFAULT_BOOL_FIELDS = ["default_prp_used", "default_exosomes_used"] as const;

/**
 * Build the subset of per-case surgery_upload_details values from clinic defaults.
 * Only non-null defaults are copied so blank defaults never overwrite anything.
 * Returns { values, applied } where applied indicates at least one field was set.
 */
export function defaultsToCaseValues(
  defaults: Partial<SurgeryUploadClinicDefaults> | null | undefined
): { values: Record<string, string | boolean>; applied: boolean } {
  const values: Record<string, string | boolean> = {};
  if (!defaults) return { values, applied: false };

  for (const [defField, caseField] of Object.entries(DEFAULT_TO_CASE_FIELD)) {
    const raw = (defaults as Record<string, unknown>)[defField];
    if (raw === null || raw === undefined || raw === "") continue;
    if (typeof raw === "string" || typeof raw === "boolean") {
      values[caseField] = raw;
    }
  }

  return { values, applied: Object.keys(values).length > 0 };
}

type SanitizedDefaults = Record<string, string | boolean | null | SurgeryChecklistConfig>;

/**
 * Resolve the per-case checklist snapshot to copy from a clinic-defaults row when a
 * new surgery upload is created. Returns a sanitized config (locked slots forced
 * required, unknown values dropped) or null when the clinic has no saved config.
 * Returning null lets the case fall back to the base HairAudit checklist at runtime.
 */
export function resolveDefaultChecklistForNewCase(
  defaults: Partial<SurgeryUploadClinicDefaults> | null | undefined
): SurgeryChecklistConfig | null {
  const raw = defaults?.default_photo_checklist_config;
  if (raw === null || raw === undefined) return null;
  return sanitizeSurgeryChecklistConfig(raw);
}

/** Validate + coerce a defaults PATCH/PUT body into a safe column set. */
export function sanitizeClinicDefaultsInput(
  body: Record<string, unknown>
): { values: SanitizedDefaults } | { error: string } {
  const values: SanitizedDefaults = {};

  for (const field of SURGERY_DEFAULT_TEXT_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === undefined || raw === "") {
      values[field] = null;
      continue;
    }
    if (typeof raw !== "string") return { error: `Field ${field} must be text` };
    values[field] = raw.slice(0, 4000);
  }

  for (const field of SURGERY_DEFAULT_BOOL_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === undefined || raw === "") {
      values[field] = null;
      continue;
    }
    if (typeof raw === "boolean") {
      values[field] = raw;
    } else if (raw === "true" || raw === "false") {
      values[field] = raw === "true";
    } else {
      return { error: `Field ${field} must be true/false` };
    }
  }

  // Stage 3: photo checklist preferences. `null` resets to the HairAudit default;
  // any object is sanitized (locked slots forced required, unknown keys dropped).
  if ("default_photo_checklist_config" in body) {
    const raw = body.default_photo_checklist_config;
    if (raw === null || raw === undefined || raw === "") {
      values.default_photo_checklist_config = null;
    } else if (typeof raw === "object") {
      values.default_photo_checklist_config = sanitizeSurgeryChecklistConfig(raw);
    } else {
      return { error: "default_photo_checklist_config must be an object or null" };
    }
  }

  return { values };
}
