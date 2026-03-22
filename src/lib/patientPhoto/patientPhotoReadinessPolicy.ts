/**
 * Additive patient photo submit policy: baseline `canSubmit("patient")` stays authoritative
 * when the stage-aware path is off or unavailable. This module only adds an optional
 * alternate path (feature-flagged) for intake-qualified post-op outcome sets.
 *
 * Alternate path matches milestone UI: front + top + (donor OR crown) per band.
 */

import { canSubmit } from "@/lib/auditPhotoSchemas";
import { filterPatientPhotosForAuditUse } from "@/lib/uploads/patientPhotoAuditMeta";

export const MONTHS_SINCE_VALUES = ["under_3", "3_6", "6_9", "9_12", "12_plus"] as const;
export type PatientIntakeMonthsSince = (typeof MONTHS_SINCE_VALUES)[number];

/** User-facing hint when alternate outcome path applies (baseline still missing). */
export const PATIENT_ALTERNATE_OUTCOME_SUBMIT_HINT =
  "Upload front, top, and either donor or crown for your recovery stage.";

export type AlternateOutcomeMilestoneSpec = {
  readonly frontKey: string;
  readonly topKey: string;
  /** Third slot: any one of these keys satisfies (donor or crown). */
  readonly supportingOneOfKeys: readonly [string, string];
};

/**
 * Per intake band: exact storage keys (patient_photo:{key}) for milestone alternate submit.
 * Third column is satisfied by donor OR crown to align with progress-tracking UI.
 */
export const ALTERNATE_OUTCOME_MILESTONE_SPECS: Readonly<
  Record<Exclude<PatientIntakeMonthsSince, "under_3">, AlternateOutcomeMilestoneSpec>
> = {
  "3_6": {
    frontKey: "postop_month3_front",
    topKey: "postop_month3_top",
    supportingOneOfKeys: ["postop_month3_donor", "postop_month3_crown"],
  },
  "6_9": {
    frontKey: "postop_month6_front",
    topKey: "postop_month6_top",
    supportingOneOfKeys: ["postop_month6_donor", "postop_month6_crown"],
  },
  "9_12": {
    frontKey: "postop_month9_front",
    topKey: "postop_month9_top",
    supportingOneOfKeys: ["postop_month9_donor", "postop_month9_crown"],
  },
  "12_plus": {
    frontKey: "postop_month12_front",
    topKey: "postop_month12_top",
    supportingOneOfKeys: ["postop_month12_donor", "postop_month12_crown"],
  },
};

/** @deprecated Use ALTERNATE_OUTCOME_MILESTONE_SPECS; kept for callers/tests that expect a flat triple. */
export const ALTERNATE_OUTCOME_REQUIRED_KEYS_BY_BAND: Readonly<
  Record<Exclude<PatientIntakeMonthsSince, "under_3">, readonly string[]>
> = {
  "3_6": [
    ALTERNATE_OUTCOME_MILESTONE_SPECS["3_6"].frontKey,
    ALTERNATE_OUTCOME_MILESTONE_SPECS["3_6"].topKey,
    ALTERNATE_OUTCOME_MILESTONE_SPECS["3_6"].supportingOneOfKeys[0],
  ],
  "6_9": [
    ALTERNATE_OUTCOME_MILESTONE_SPECS["6_9"].frontKey,
    ALTERNATE_OUTCOME_MILESTONE_SPECS["6_9"].topKey,
    ALTERNATE_OUTCOME_MILESTONE_SPECS["6_9"].supportingOneOfKeys[0],
  ],
  "9_12": [
    ALTERNATE_OUTCOME_MILESTONE_SPECS["9_12"].frontKey,
    ALTERNATE_OUTCOME_MILESTONE_SPECS["9_12"].topKey,
    ALTERNATE_OUTCOME_MILESTONE_SPECS["9_12"].supportingOneOfKeys[0],
  ],
  "12_plus": [
    ALTERNATE_OUTCOME_MILESTONE_SPECS["12_plus"].frontKey,
    ALTERNATE_OUTCOME_MILESTONE_SPECS["12_plus"].topKey,
    ALTERNATE_OUTCOME_MILESTONE_SPECS["12_plus"].supportingOneOfKeys[0],
  ],
};

export type PatientPhotoUploadRow = { type?: string | null; metadata?: unknown };

function parsePatientPhotoKey(type: string | null | undefined): string | null {
  const t = String(type ?? "").trim().toLowerCase();
  if (!t.startsWith("patient_photo:")) return null;
  const raw = t.slice("patient_photo:".length).trim().toLowerCase();
  return raw || null;
}

/** Count uploads per exact storage key (type suffix only; exclusion applied upstream). */
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

export function alternateMilestoneSpecForMonthsSince(
  months: PatientIntakeMonthsSince | null
): AlternateOutcomeMilestoneSpec | null {
  if (!months || months === "under_3") return null;
  return ALTERNATE_OUTCOME_MILESTONE_SPECS[months] ?? null;
}

/** @deprecated Use alternateMilestoneSpecForMonthsSince */
export function alternateOutcomeKeysForMonthsSince(
  months: PatientIntakeMonthsSince | null
): readonly string[] | null {
  const spec = alternateMilestoneSpecForMonthsSince(months);
  if (!spec) return null;
  return [spec.frontKey, spec.topKey, spec.supportingOneOfKeys[0]];
}

export function patientRowsSatisfyExactKeys(
  rows: PatientPhotoUploadRow[],
  requiredKeys: readonly string[]
): boolean {
  const counts = countPatientPhotoKeysForRows(rows);
  return requiredKeys.every((k) => (counts[k.toLowerCase()] ?? 0) >= 1);
}

/** Alternate submit: front + top + at least one supporting (donor or crown). */
export function patientRowsSatisfyAlternateMilestoneOutcome(
  rows: PatientPhotoUploadRow[],
  months: Exclude<PatientIntakeMonthsSince, "under_3">
): boolean {
  const spec = ALTERNATE_OUTCOME_MILESTONE_SPECS[months];
  if (!spec) return false;
  const counts = countPatientPhotoKeysForRows(rows);
  const has = (k: string) => (counts[k.toLowerCase()] ?? 0) >= 1;
  if (!has(spec.frontKey) || !has(spec.topKey)) return false;
  return spec.supportingOneOfKeys.some((k) => has(k));
}

export type PatientPhotoSubmitGateResult = {
  allowed: boolean;
  viaBaseline: boolean;
  viaAlternateOutcome: boolean;
  stageAwareEvaluated: boolean;
  monthsSince: PatientIntakeMonthsSince | null;
  /** When stage-aware alternate path applies: fixed front + top keys. */
  alternateKeysRequired: readonly string[] | null;
  /** When set with `alternateKeysRequired`, user must also satisfy one of these (donor or crown). */
  alternateSupportingOneOf: readonly string[] | null;
};

/**
 * Full patient photo submit gate: baseline OR (flag + intake band + alternate milestone set).
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
  const milestoneSpec =
    args.stageAwareSubmitEnabled && monthsSince && monthsSince !== "under_3"
      ? ALTERNATE_OUTCOME_MILESTONE_SPECS[monthsSince]
      : null;

  const alternateKeysRequired = milestoneSpec
    ? ([milestoneSpec.frontKey, milestoneSpec.topKey] as const)
    : null;
  const alternateSupportingOneOf = milestoneSpec ? milestoneSpec.supportingOneOfKeys : null;

  const stageAwareEvaluated = Boolean(milestoneSpec);

  const viaAlternateOutcome =
    stageAwareEvaluated &&
    monthsSince != null &&
    monthsSince !== "under_3" &&
    patientRowsSatisfyAlternateMilestoneOutcome(
      patientRows,
      monthsSince as Exclude<PatientIntakeMonthsSince, "under_3">
    );

  return {
    allowed: viaBaseline || viaAlternateOutcome,
    viaBaseline,
    viaAlternateOutcome,
    stageAwareEvaluated,
    monthsSince,
    alternateKeysRequired: alternateKeysRequired ? [...alternateKeysRequired] : null,
    alternateSupportingOneOf: alternateSupportingOneOf ? [...alternateSupportingOneOf] : null,
  };
}
