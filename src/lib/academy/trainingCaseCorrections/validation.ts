import { z } from "zod";
import { TRAINING_CASE_STATUSES, CORRECTION_REASON_MIN_LENGTH } from "./constants";
import { diffClockMinutes } from "@/lib/academy/trainingCaseMetricsDerived";

export const correctionReasonSchema = z
  .string()
  .trim()
  .min(CORRECTION_REASON_MIN_LENGTH, `Reason must be at least ${CORRECTION_REASON_MIN_LENGTH} characters`);

export const caseDetailsCorrectionSchema = z.object({
  reason: correctionReasonSchema,
  surgery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  training_doctor_id: z.string().uuid().optional(),
  trainer_id: z.string().uuid().optional(),
  procedure_type: z.string().max(200).nullable().optional(),
  complexity_level: z.string().max(200).nullable().optional(),
  patient_sex: z.string().max(50).nullable().optional(),
  patient_age_band: z.string().max(100).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  status: z.enum(TRAINING_CASE_STATUSES).optional(),
});

export const metricsCorrectionSchema = z.object({
  reason: correctionReasonSchema,
  metrics: z.record(z.string(), z.unknown()),
});

export const uploadCategoryCorrectionSchema = z.object({
  reason: correctionReasonSchema,
  category: z.string().min(1).max(80),
  caption: z.string().max(500).nullable().optional(),
});

export const uploadDeleteCorrectionSchema = z.object({
  reason: correctionReasonSchema,
});

export const archiveCaseSchema = z.object({
  reason: correctionReasonSchema,
  mode: z.enum(["archived", "voided"]),
});

export const restoreCaseSchema = z.object({
  reason: correctionReasonSchema,
});

export const softDeleteCaseSchema = z.object({
  reason: correctionReasonSchema,
});

const nonNegativeInt = z
  .number()
  .int()
  .nonnegative()
  .nullable()
  .optional();

export function validateMetricsNumbers(metrics: Record<string, unknown>): string | null {
  const intFields = [
    "grafts_attempted",
    "grafts_extracted",
    "grafts_implanted",
    "total_hairs",
    "transected_grafts_count",
    "buried_grafts_count",
    "popped_grafts_count",
  ] as const;

  for (const key of intFields) {
    if (metrics[key] === undefined) continue;
    const parsed = nonNegativeInt.safeParse(metrics[key]);
    if (!parsed.success) return `${key} must be a non-negative whole number`;
  }

  const extStart = metrics.extraction_start_time != null ? String(metrics.extraction_start_time) : null;
  const extEnd = metrics.extraction_end_time != null ? String(metrics.extraction_end_time) : null;
  const impStart = metrics.implantation_start_time != null ? String(metrics.implantation_start_time) : null;
  const impEnd = metrics.implantation_end_time != null ? String(metrics.implantation_end_time) : null;

  if (extStart && extEnd) {
    const d = diffClockMinutes(extStart, extEnd);
    if (d == null) return "Extraction times are invalid";
    if (d <= 0) return "Extraction finish must be after extraction start";
  }

  if (impStart && impEnd) {
    const d = diffClockMinutes(impStart, impEnd);
    if (d == null) return "Implantation times are invalid";
    if (d <= 0) return "Implantation finish must be after implantation start";
  }

  const grafts = metrics.grafts_implanted ?? metrics.grafts_extracted;
  const hairs = metrics.total_hairs;
  if (
    grafts != null &&
    hairs != null &&
    typeof grafts === "number" &&
    typeof hairs === "number" &&
    hairs < grafts
  ) {
    return "Hair count is lower than graft count — confirm this is intentional before saving";
  }

  return null;
}

export type MetricsValidationWarning = {
  code: "hair_below_grafts";
  message: string;
};

export function metricsValidationWarning(metrics: Record<string, unknown>): MetricsValidationWarning | null {
  const msg = validateMetricsNumbers(metrics);
  if (msg?.includes("confirm this is intentional")) {
    return { code: "hair_below_grafts", message: msg };
  }
  return null;
}
