/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Patient consent for illustrative projection sharing.
 *
 * Before sharing, record that the patient has been informed of illustrative limits.
 * Patient page must always show approval date and plan version.
 */

export const PATIENT_PROJECTION_CONSENT_STATEMENTS = [
  "The projection is illustrative.",
  "It is based on the current plan and supplied images.",
  "It does not predict exact graft survival or growth.",
  "It does not guarantee density or final appearance.",
  "Surgical decisions remain subject to in-person clinical assessment.",
  "The plan may change on the day of surgery.",
] as const;

export type PatientProjectionConsentRecord = {
  id: string;
  caseId: string;
  projectionId: string;
  patientUserId: string | null;
  recordedBy: string;
  recordedAt: string;
  statementsAcknowledged: readonly string[];
  allStatementsConfirmed: boolean;
  approvalDateShown: string;
  graftPlanVersionShown: number;
  graftPlanIdShown: string;
  schemaVersion: "ha-pre-surgery-projection-consent-v1";
};

export type BuildConsentInput = {
  id?: string;
  caseId: string;
  projectionId: string;
  patientUserId?: string | null;
  recordedBy: string;
  recordedAt?: string;
  confirmedStatements: string[];
  approvalDate: string;
  graftPlanId: string;
  graftPlanVersion: number;
};

export type ConsentBuildResult =
  | { ok: true; record: PatientProjectionConsentRecord }
  | { ok: false; code: string; message: string; missing: string[] };

export function buildPatientProjectionConsentRecord(
  input: BuildConsentInput
): ConsentBuildResult {
  const required = [...PATIENT_PROJECTION_CONSENT_STATEMENTS];
  const confirmed = new Set(input.confirmedStatements.map((s) => s.trim()));
  const missing = required.filter((s) => !confirmed.has(s));
  if (missing.length > 0) {
    return {
      ok: false,
      code: "consent_incomplete",
      message: "All illustrative-projection consent statements must be acknowledged",
      missing,
    };
  }
  if (!input.approvalDate) {
    return {
      ok: false,
      code: "approval_date_required",
      message: "Approval date must be recorded on the consent",
      missing: [],
    };
  }
  if (!input.graftPlanId || input.graftPlanVersion < 1) {
    return {
      ok: false,
      code: "plan_version_required",
      message: "Graft-plan version must be recorded on the consent",
      missing: [],
    };
  }

  return {
    ok: true,
    record: {
      id: input.id ?? crypto.randomUUID(),
      caseId: input.caseId,
      projectionId: input.projectionId,
      patientUserId: input.patientUserId ?? null,
      recordedBy: input.recordedBy,
      recordedAt: input.recordedAt ?? new Date().toISOString(),
      statementsAcknowledged: required,
      allStatementsConfirmed: true,
      approvalDateShown: input.approvalDate,
      graftPlanVersionShown: input.graftPlanVersion,
      graftPlanIdShown: input.graftPlanId,
      schemaVersion: "ha-pre-surgery-projection-consent-v1",
    },
  };
}

/** Patient-facing presentation metadata (never certainty language). */
export type PatientProjectionPresentation = {
  approvalDate: string;
  graftPlanVersion: number;
  graftPlanId: string;
  framing: readonly string[];
  label: string;
};

export function buildPatientProjectionPresentation(input: {
  approvalDate: string | null | undefined;
  graftPlanVersion: number;
  graftPlanId: string;
  label: string;
  framing: readonly string[];
}): PatientProjectionPresentation | { error: string } {
  if (!input.approvalDate) {
    return { error: "Patient page must show the projection approval date" };
  }
  if (!input.graftPlanId || input.graftPlanVersion < 1) {
    return { error: "Patient page must show the plan version the projection was based on" };
  }
  return {
    approvalDate: input.approvalDate,
    graftPlanVersion: input.graftPlanVersion,
    graftPlanId: input.graftPlanId,
    framing: input.framing,
    label: input.label,
  };
}
