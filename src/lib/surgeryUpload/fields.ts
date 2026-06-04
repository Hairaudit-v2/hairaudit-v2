// HairAudit Mobile Surgery Upload Portal — structured field model (Stage 1)

export const SURGERY_PROCEDURE_TYPES = [
  { value: "scalp", label: "Scalp" },
  { value: "beard", label: "Beard" },
  { value: "eyebrow", label: "Eyebrow" },
  { value: "female_hairline", label: "Female hairline" },
  { value: "repair", label: "Repair" },
  { value: "other", label: "Other" },
] as const;

export type SurgeryProcedureType = (typeof SURGERY_PROCEDURE_TYPES)[number]["value"];

const PROCEDURE_TYPE_SET = new Set<string>(SURGERY_PROCEDURE_TYPES.map((p) => p.value));

export function isValidProcedureType(value: unknown): value is SurgeryProcedureType {
  return typeof value === "string" && PROCEDURE_TYPE_SET.has(value);
}

export type SurgeryUploadStatus = "draft" | "submitted";

/** Full surgery_upload_details row shape used across server + client. */
export type SurgeryUploadDetails = {
  id: string;
  case_id: string;
  created_by: string | null;
  patient_reference: string | null;
  clinic_name: string | null;
  clinic_profile_id: string | null;
  surgeon_name: string | null;
  surgery_date: string | null;
  procedure_type: SurgeryProcedureType | null;
  notes: string | null;
  extraction_machine: string | null;
  punch_size: string | null;
  punch_type: string | null;
  implantation_method: string | null;
  prp_used: boolean | null;
  exosomes_used: boolean | null;
  storage_solution: string | null;
  planned_grafts: number | null;
  actual_grafts: number | null;
  extraction_start_time: string | null;
  implantation_start_time: string | null;
  surgery_finish_time: string | null;
  complication_notes: string | null;
  status: SurgeryUploadStatus;
  submitted_at: string | null;
  submitted_by: string | null;
  prefilled_from_clinic_defaults: boolean;
  /** Stage 3: per-case checklist snapshot (null => base HairAudit checklist). */
  photo_checklist_config: unknown | null;
  // Stage 5: evidence review workflow (separate from status/cases.status).
  evidence_review_status: string;
  evidence_reviewed_at: string | null;
  evidence_reviewed_by: string | null;
  evidence_review_notes: string | null;
  evidence_requested_at: string | null;
  evidence_requested_by: string | null;
  evidence_request_message: string | null;
  evidence_resolved_at: string | null;
  evidence_resolved_by: string | null;
  ready_for_audit_at: string | null;
  ready_for_audit_by: string | null;
  // Stage 6B: controlled audit-pipeline handoff marker (separate from cases.status).
  audit_handoff_status: string;
  audit_handoff_requested_at: string | null;
  audit_handoff_requested_by: string | null;
  audit_handoff_completed_at: string | null;
  audit_handoff_completed_by: string | null;
  audit_handoff_error: string | null;
  audit_handoff_notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Columns clients are allowed to write via the PATCH route. */
export const SURGERY_EDITABLE_TEXT_FIELDS = [
  "patient_reference",
  "clinic_name",
  "surgeon_name",
  "notes",
  "extraction_machine",
  "punch_size",
  "punch_type",
  "implantation_method",
  "storage_solution",
  "extraction_start_time",
  "implantation_start_time",
  "surgery_finish_time",
  "complication_notes",
] as const;

export const SURGERY_EDITABLE_INT_FIELDS = ["planned_grafts", "actual_grafts"] as const;

export const SURGERY_EDITABLE_BOOL_FIELDS = ["prp_used", "exosomes_used"] as const;

/**
 * Stage 4B: the full set of user-editable surgery-upload form fields. This is the
 * canonical list for local draft recovery — only these columns are ever cached on
 * the device (never images, signed URLs, or server-managed columns). Derived from
 * the editable field lists above so the recovery layer can't drift from autosave.
 */
export const SURGERY_RECOVERABLE_FIELDS = [
  ...SURGERY_EDITABLE_TEXT_FIELDS,
  ...SURGERY_EDITABLE_INT_FIELDS,
  ...SURGERY_EDITABLE_BOOL_FIELDS,
  "procedure_type",
  "surgery_date",
] as const;

export type SurgeryRecoverableField = (typeof SURGERY_RECOVERABLE_FIELDS)[number];

/** The editable subset of SurgeryUploadDetails used by autosave + local recovery. */
export type SurgeryUploadDetailsInput = Pick<SurgeryUploadDetails, SurgeryRecoverableField>;

type SanitizedDetails = Record<string, string | number | boolean | null>;

/**
 * Validate + coerce an incoming PATCH body into a safe column set.
 * Unknown keys are ignored. Returns { values } or { error }.
 */
export function sanitizeSurgeryDetailsInput(
  body: Record<string, unknown>
): { values: SanitizedDetails } | { error: string } {
  const values: SanitizedDetails = {};

  for (const field of SURGERY_EDITABLE_TEXT_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === undefined || raw === "") {
      values[field] = null;
      continue;
    }
    if (typeof raw !== "string") return { error: `Field ${field} must be text` };
    values[field] = raw.slice(0, 4000);
  }

  for (const field of SURGERY_EDITABLE_INT_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === undefined || raw === "") {
      values[field] = null;
      continue;
    }
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num) || num < 0 || num > 1_000_000) {
      return { error: `Field ${field} must be a non-negative number` };
    }
    values[field] = Math.round(num);
  }

  for (const field of SURGERY_EDITABLE_BOOL_FIELDS) {
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

  if ("procedure_type" in body) {
    const raw = body.procedure_type;
    if (raw === null || raw === undefined || raw === "") {
      values.procedure_type = null;
    } else if (isValidProcedureType(raw)) {
      values.procedure_type = raw;
    } else {
      return { error: "Invalid procedure_type" };
    }
  }

  if ("surgery_date" in body) {
    const raw = body.surgery_date;
    if (raw === null || raw === undefined || raw === "") {
      values.surgery_date = null;
    } else if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      values.surgery_date = raw;
    } else {
      return { error: "surgery_date must be YYYY-MM-DD" };
    }
  }

  return { values };
}
