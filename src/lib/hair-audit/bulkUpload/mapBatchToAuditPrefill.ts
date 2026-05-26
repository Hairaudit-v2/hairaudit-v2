import type { AuditOption } from "@/lib/audit/masterSurgicalMetadata";
import {
  EXTRACTION_METHOD_OPTIONS,
  IMPLANTATION_METHOD_OPTIONS,
  PUNCH_SIZE_OPTIONS,
  PUNCH_TYPE_OPTIONS,
} from "@/lib/audit/masterSurgicalMetadata";
import type { HairAuditCaseBatchRow } from "./types";

function matchOptionValue(text: string | null | undefined, options: AuditOption[]): string | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const option of options) {
    if (option.value.toLowerCase() === lower || option.label.toLowerCase() === lower) return option.value;
  }
  for (const option of options) {
    const label = option.label.toLowerCase();
    if (lower.includes(label) || label.includes(lower)) return option.value;
  }
  const normalized = lower.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  for (const option of options) {
    if (option.value === normalized) return option.value;
  }
  return null;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** Map bulk batch shared fields to doctor/clinic audit form keys (values only). */
export function mapBatchToAuditPrefill(batch: HairAuditCaseBatchRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (batch.shared_surgery_date) out.surgery_date = batch.shared_surgery_date;
  if (batch.shared_location?.trim()) {
    out.clinic_branch = batch.shared_location.trim();
    out.clinicLocation = batch.shared_location.trim();
  }

  const punchType = matchOptionValue(batch.shared_punch_type, PUNCH_TYPE_OPTIONS);
  if (punchType) {
    out.primary_punch_type = punchType;
    out.punch_types_used = [punchType];
  }

  const punchSize = matchOptionValue(batch.shared_punch_size, PUNCH_SIZE_OPTIONS);
  if (punchSize) {
    out.primary_punch_size = punchSize;
    out.punch_sizes_used = [punchSize];
  } else if (batch.shared_punch_size?.trim()) {
    out.punch_size_change_notes = batch.shared_punch_size.trim();
  }

  const extraction = matchOptionValue(batch.shared_extraction_method, EXTRACTION_METHOD_OPTIONS);
  if (extraction) out.extraction_method = [extraction];

  const implantation = matchOptionValue(batch.shared_implantation_method, IMPLANTATION_METHOD_OPTIONS);
  if (implantation) out.implantation_method = [implantation];

  if (batch.shared_equipment_notes?.trim()) {
    out.extraction_device_change_notes = batch.shared_equipment_notes.trim();
  }
  if (batch.shared_preservation_notes?.trim()) {
    out.holding_solution_notes = batch.shared_preservation_notes.trim();
  }

  return out;
}

export function applyBulkBatchPrefillToAnswers(
  existing: Record<string, unknown>,
  batchPrefill: Record<string, unknown>
): { answers: Record<string, unknown>; prefilledKeys: string[] } {
  const answers = { ...existing };
  const prefilledKeys: string[] = [];

  for (const [key, value] of Object.entries(batchPrefill)) {
    if (isEmptyValue(answers[key]) && !isEmptyValue(value)) {
      answers[key] = value;
      prefilledKeys.push(key);
    }
  }

  return { answers, prefilledKeys };
}

export const BULK_BATCH_PROVENANCE = "inherited_from_bulk_batch" as const;
