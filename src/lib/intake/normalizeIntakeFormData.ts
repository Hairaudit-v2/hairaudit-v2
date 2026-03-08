/**
 * Canonical intake form state: flat structure for reliability.
 * Single source of truth across steps, review summary, and submit payload.
 */

import { PATIENT_AUDIT_SECTIONS } from "@/lib/patientAuditForm";

/** Flat canonical type — all fields at top level, keyed by question id (including dot-path for advanced). */
export type IntakeFormData = Record<string, unknown>;

/** All field keys from the form definition (basic + advanced). */
export const INTAKE_FORM_FIELD_KEYS: string[] = PATIENT_AUDIT_SECTIONS.flatMap((s) =>
  s.questions.map((q) => q.id)
);

/** Keys for advanced sections only (for completion stats). */
export const ADVANCED_SECTION_KEYS: Record<string, string[]> = {};
for (const sec of PATIENT_AUDIT_SECTIONS) {
  if (sec.advanced) {
    ADVANCED_SECTION_KEYS[sec.id] = sec.questions.map((q) => q.id);
  }
}

function flattenInto(
  obj: unknown,
  prefix: string,
  out: Record<string, unknown>
): void {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (
      v !== null &&
      v !== undefined &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      flattenInto(v, path, out);
    } else {
      out[path] = v;
    }
  }
}

/**
 * Normalize raw data (nested or flat) into canonical flat IntakeFormData.
 * Preserves backward compatibility for older saved drafts.
 */
export function normalizeIntakeFormData(
  raw: Record<string, unknown> | null | undefined
): IntakeFormData {
  if (!raw || typeof raw !== "object") return {};

  const out: IntakeFormData = {};

  // 1) Copy top-level primitive/array values as-is
  for (const [k, v] of Object.entries(raw)) {
    if (
      v === null ||
      v === undefined ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      Array.isArray(v)
    ) {
      out[k] = v;
    }
  }

  // 2) Flatten enhanced_patient_answers.* into dot-path keys
  const epa = raw.enhanced_patient_answers;
  if (epa && typeof epa === "object" && !Array.isArray(epa)) {
    flattenInto(epa, "enhanced_patient_answers", out);
  }

  // 3) Legacy nested shapes: spread into flat for backward compat
  const adv = raw.advanced as Record<string, unknown> | undefined;
  if (adv && typeof adv === "object" && !Array.isArray(adv)) {
    Object.assign(out, adv);
  }
  const proc = raw.procedure as Record<string, unknown> | undefined;
  if (proc && typeof proc === "object" && !Array.isArray(proc)) {
    Object.assign(out, proc);
  }
  const heal = raw.healing as Record<string, unknown> | undefined;
  if (heal && typeof heal === "object" && !Array.isArray(heal)) {
    Object.assign(out, heal);
  }

  return out;
}

/**
 * Convert canonical flat form data to nested structure for API/backend.
 * Transform only at API boundary.
 */
export function toNestedForApi(flat: IntakeFormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const epa: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined) continue;

    if (key.startsWith("enhanced_patient_answers.")) {
      const rest = key.slice("enhanced_patient_answers.".length);
      const parts = rest.split(".");
      let cur: Record<string, unknown> = epa;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!;
        const last = i === parts.length - 1;
        if (last) {
          cur[p] = value;
        } else {
          if (!cur[p] || typeof cur[p] !== "object" || Array.isArray(cur[p])) {
            cur[p] = {};
          }
          cur = cur[p] as Record<string, unknown>;
        }
      }
    } else {
      result[key] = value;
    }
  }

  if (Object.keys(epa).length > 0) {
    result.enhanced_patient_answers = epa;
  }

  return result;
}

export type CompletionStatus = {
  complete: number;
  total: number;
  pct: number;
  bySection?: Record<string, { complete: number; total: number; pct: number }>;
};

/**
 * Compute completion status for given field keys.
 */
export function getCompletionStatus(
  values: IntakeFormData,
  fieldKeys: string[]
): CompletionStatus {
  const total = fieldKeys.length || 1;
  const complete = fieldKeys.filter((key) => {
    const v = values[key];
    return v !== null && v !== undefined && v !== "";
  }).length;
  return {
    complete,
    total,
    pct: total > 0 ? complete / total : 0,
  };
}

/**
 * Get completion status for all advanced sections.
 */
export function getAdvancedSectionsCompletion(
  values: IntakeFormData
): Record<string, CompletionStatus> {
  const out: Record<string, CompletionStatus> = {};
  for (const [sectionId, keys] of Object.entries(ADVANCED_SECTION_KEYS)) {
    out[sectionId] = getCompletionStatus(values, keys);
  }
  return out;
}
