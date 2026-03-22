/**
 * Additive patient photo submit policy: baseline `canSubmit("patient")` stays authoritative
 * when the stage-aware path is off or unavailable. This module only adds an optional
 * alternate path (feature-flagged) for intake-qualified post-op outcome sets.
 */

import { canSubmit } from "@/lib/auditPhotoSchemas";
import { filterPatientPhotosForAuditUse } from "@/lib/uploads/patientPhotoAuditMeta";

export const MONTHS_SINCE_VALUES = ["under_3", "3_6", "6_9", "9_12", "12_plus"] as const;
export type PatientIntakeMonthsSince = (typeof MONTHS_SINCE_VALUES)[number];

/** For each band, require one upload per listed storage category (patient_photo:{key}). */
export const ALTERNATE_OUTCOME_REQUIRED_KEYS_BY_BAND: Readonly<
  Record<Exclude<PatientIntakeMonthsSince, "under_3">, readonly string[]>
> = {
  "3_6": ["postop_month3_front", "postop_month3_top", "postop_month3_donor"],
  "6_9": ["postop_month6_front", "postop_month6_top", "postop_month6_donor"],
  "9_12": ["postop_month9_front", "postop_month9_top", "postop_month9_donor"],
  "12_plus": ["postop_month12_front", "postop_month12_top", "postop_month12_donor"],
};

export type PatientPhotoUploadRow = { type?: string | null; metadata?: unknown };

function parsePatientPhotoKey(type: string | null | undefined): string | null {
  const t = String(type ?? "").trim().toLowerCase();
  if (!t.startsWith("patient_photo:")) return null;
  const raw = t.slice("patient_photo:".length).trim().toLowerCase();
  return raw || null;
}

/** Count uploads per exact storage key (post-normalization of type string only; exclusion applied upstream). */
export function countPatientPhotoKeysForRows(
  rows: PatientPhotoUploadRow[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const u of rows) {
    const k = parsePatientPhotoKey(u.type ?? "");
    if (!k) continue;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export function readMonthsSinceFromPatientAnswers(
  answers: Record<string, unknown> | null | undefined
): PatientIntakeMonthsSince | null {
  if (!answers || typeof answers !== "object") return null;
  const v = answers.months_since;
  if (typeof v !== "string") return null;
  const t = v.trim() as PatientIntakeMonthsSince;
  return (MONTHS_SINCE_VALUES as readonly string[]).includes(t) ? t : null;
}

export function alternateOutcomeKeysForMonthsSince(
  months: PatientIntakeMonthsSince | null
): readonly string[] | null {
  if (!months || months === "under_3") return null;
  return ALTERNATE_OUTCOME_REQUIRED_KEYS_BY_BAND[months] ?? null;
}

export function patientRowsSatisfyExactKeys(
  rows: PatientPhotoUploadRow[],
  requiredKeys: readonly string[]
): boolean {
  const counts = countPatientPhotoKeysForRows(rows);
  return requiredKeys.every((k) => (counts[k.toLowerCase()] ?? 0) >= 1);
}

export type PatientPhotoSubmitGateResult = {
  allowed: boolean;
  viaBaseline: boolean;
  viaAlternateOutcome: boolean;
  stageAwareEvaluated: boolean;
  monthsSince: PatientIntakeMonthsSince | null;
  alternateKeysRequired: readonly string[] | null;
};

/**
 * Full patient photo submit gate: baseline OR (flag + intake band + alternate set).
 * Does not mutate inputs. When `stageAwareSubmitEnabled` is false, result matches baseline only.
 */
export function evaluatePatientPhotoSubmitGate(args: {
  uploadRows: PatientPhotoUploadRow[];
  patientAnswers: Record<string, unknown> | null | undefined;
  stageAwareSubmitEnabled: boolean;
}): PatientPhotoSubmitGateResult {
  const patientRows = filterPatientPhotosForAuditUse(
    args.uploadRows.filter((u) => String(u.type ?? "").toLowerCase().startsWith("patient_photo:"))
  );
  const photoPayload = patientRows.map((u) => ({ type: u.type ?? undefined }));
  const viaBaseline = canSubmit("patient", photoPayload);

  const monthsSince = readMonthsSinceFromPatientAnswers(args.patientAnswers ?? null);
  const alternateKeysRequired = args.stageAwareSubmitEnabled
    ? alternateOutcomeKeysForMonthsSince(monthsSince)
    : null;

  const stageAwareEvaluated = Boolean(args.stageAwareSubmitEnabled && alternateKeysRequired?.length);

  const viaAlternateOutcome =
    stageAwareEvaluated &&
    alternateKeysRequired != null &&
    patientRowsSatisfyExactKeys(patientRows, alternateKeysRequired);

  return {
    allowed: viaBaseline || viaAlternateOutcome,
    viaBaseline,
    viaAlternateOutcome,
    stageAwareEvaluated,
    monthsSince,
    alternateKeysRequired,
  };
}
