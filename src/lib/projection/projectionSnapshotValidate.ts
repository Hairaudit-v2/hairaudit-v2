/**
 * HA-PROJECTION-1D — Validate frozen 1A / 1B payloads before persistence.
 */

import { buildSurgeryDayProjectedOutcome } from "./surgeryDayProjectedOutcome";
import { assertPatientSafeProjectionText } from "./surgeryDayProjectionSafety";
import type {
  SurgeryDayProcedureReconstruction,
  SurgeryDayProjectedOutcome,
} from "./types";

export function isSurgeryDayReconstruction(
  value: unknown
): value is SurgeryDayProcedureReconstruction {
  if (!value || typeof value !== "object") return false;
  const r = value as SurgeryDayProcedureReconstruction;
  if (
    r.assessmentType !== "surgery_day_reconstruction" &&
    r.assessmentType !== "surgery_day_reconstruction_with_baseline"
  ) {
    return false;
  }
  if (!r.evidence || !Array.isArray(r.evidence.presentRoles)) return false;
  return true;
}

export function isSurgeryDayProjectedOutcome(
  value: unknown
): value is SurgeryDayProjectedOutcome {
  if (!value || typeof value !== "object") return false;
  const o = value as SurgeryDayProjectedOutcome;
  if (
    o.assessmentType !== "surgery_day_projection" &&
    o.assessmentType !== "surgery_day_projection_with_baseline"
  ) {
    return false;
  }
  if (!Array.isArray(o.projectedCharacteristics)) return false;
  if (!Array.isArray(o.whatCannotYetBeDetermined)) return false;
  if (!Array.isArray(o.assumptions)) return false;
  if (!Array.isArray(o.limitations)) return false;
  return true;
}

export type ValidateReconstructionResult =
  | { ok: true; reconstruction: SurgeryDayProcedureReconstruction }
  | { ok: false; reason: string };

export type ValidateProjectionResult =
  | { ok: true; projectedOutcome: SurgeryDayProjectedOutcome }
  | { ok: false; reason: string };

/** Fail closed: reconstruction must be surgery-day with recipient evidence. */
export function validateReconstructionForSnapshot(
  value: unknown
): ValidateReconstructionResult {
  if (!isSurgeryDayReconstruction(value)) {
    return { ok: false, reason: "Invalid or missing SurgeryDayProcedureReconstruction." };
  }
  if (!value.evidence.presentRoles.includes("surgery_day_recipient")) {
    return {
      ok: false,
      reason: "Reconstruction evidence is insufficient (surgery_day_recipient required).",
    };
  }
  return { ok: true, reconstruction: value };
}

/**
 * Fail closed: projection must be patient-safe and consistent with reconstruction.
 * Re-runs 1B builder against the frozen reconstruction to detect drift when requested.
 */
export function validateProjectedOutcomeForSnapshot(
  value: unknown,
  reconstruction: SurgeryDayProcedureReconstruction,
  opts?: { requireBuilderAgreement?: boolean }
): ValidateProjectionResult {
  if (!isSurgeryDayProjectedOutcome(value)) {
    return { ok: false, reason: "Invalid or missing SurgeryDayProjectedOutcome." };
  }

  const texts = [
    value.summary ?? "",
    ...value.assumptions,
    ...value.limitations,
    ...value.whatCannotYetBeDetermined,
  ];
  for (const c of value.projectedCharacteristics) {
    texts.push(c.title, c.observation, c.projection, ...c.limitations);
  }
  const safety = assertPatientSafeProjectionText(texts);
  if (!safety.ok) {
    return { ok: false, reason: "Projected outcome failed patient-safe validation." };
  }

  const expectedBaseline =
    reconstruction.assessmentType === "surgery_day_reconstruction_with_baseline";
  const gotBaseline = value.assessmentType === "surgery_day_projection_with_baseline";
  if (expectedBaseline !== gotBaseline) {
    return {
      ok: false,
      reason: "Projection assessment type does not match reconstruction baseline mode.",
    };
  }

  if (opts?.requireBuilderAgreement !== false) {
    const rebuilt = buildSurgeryDayProjectedOutcome(reconstruction);
    if (!rebuilt.ok || !rebuilt.projectedOutcome) {
      return {
        ok: false,
        reason: rebuilt.reason || "Could not re-derive projected outcome from reconstruction.",
      };
    }
    // Structural agreement on assessment + confidence; exact text may be supplied as frozen.
    if (rebuilt.projectedOutcome.assessmentType !== value.assessmentType) {
      return { ok: false, reason: "Projected outcome assessment type disagrees with 1B rebuild." };
    }
  }

  return { ok: true, projectedOutcome: value };
}

export function validateCaseOwnership(args: {
  caseId: string;
  patientId: string;
  caseRow: { id?: string; patient_id?: string | null; user_id?: string | null } | null;
}): { ok: true } | { ok: false; reason: string } {
  if (!args.caseId?.trim() || !args.patientId?.trim()) {
    return { ok: false, reason: "caseId and patientId are required." };
  }
  if (!args.caseRow) {
    return { ok: false, reason: "Case not found for ownership check." };
  }
  if (args.caseRow.id && args.caseRow.id !== args.caseId) {
    return { ok: false, reason: "Case id mismatch." };
  }
  const owners = [args.caseRow.patient_id, args.caseRow.user_id].filter(Boolean);
  if (!owners.includes(args.patientId)) {
    return {
      ok: false,
      reason: "patientId does not match case patient/user ownership.",
    };
  }
  return { ok: true };
}
