import { normalizeIntakeFormData, toNestedForApi } from "@/lib/intake/normalizeIntakeFormData";

/** Minimal report row shape for resolving patient answers (v2 or legacy summary). */
export type ReportRowForPatientAnswers = {
  summary?: Record<string, unknown> | null;
  patient_audit_version?: number | null;
  patient_audit_v2?: Record<string, unknown> | null;
};

/**
 * Normalized patient answers for audit / photo policy (same merge as inngest `load-report-summary`).
 * Safe to call with null/empty report rows.
 */
export function normalizedPatientAnswersFromReportRow(
  data: ReportRowForPatientAnswers | null | undefined
): Record<string, unknown> | null {
  if (!data) return null;
  const s = (data.summary ?? {}) as Record<string, unknown>;
  const savedV2 =
    data.patient_audit_version === 2 &&
    data.patient_audit_v2 &&
    typeof data.patient_audit_v2 === "object"
      ? data.patient_audit_v2
      : null;
  const summaryPatient = (s.patient_answers ?? null) as Record<string, unknown> | null;
  const raw = savedV2 ?? summaryPatient;
  if (!raw || typeof raw !== "object") return null;
  const flat = normalizeIntakeFormData(raw);
  const nested = toNestedForApi(flat);
  return {
    ...raw,
    ...nested,
  };
}
