/**
 * HA-PROJECTION-1G — Report-layer safety for longitudinal projection review.
 *
 * Re-validates frozen 1B / 1E / 1F texts via layered validators, and blocks
 * additional patient-facing success / accuracy / survival claims at the report layer.
 * Presentation only — no new intelligence.
 */

import { assertPatientSafeProjectionText } from "@/lib/projection/surgeryDayProjectionSafety";
import { assertPatientSafeLongitudinalObservation } from "@/lib/projection/longitudinalObservationSafety";
import { assertPatientSafeComparisonText } from "@/lib/projection/projectionComparisonSafety";

export type LongitudinalReviewSafetyViolation = {
  source: "projection" | "observation" | "comparison" | "report";
  text: string;
  pattern: string;
};

/**
 * Report-layer forbidden patterns (defensive).
 * Layered 1B/1E/1F validation runs separately via validateFrozenInputsForLongitudinalReview.
 * Do not re-apply observation/comparison finders to every string — 1B denial phrasing
 * such as "final result cannot yet be assessed" is valid projection copy.
 */
const REPORT_EXTRA_FORBIDDEN: readonly RegExp[] = [
  /\bsuccessful transplant\b/i,
  /\bfailed transplant\b/i,
  /\bbetter than (expected|projected|predicted)\b/i,
  /\bworse than (expected|projected|predicted)\b/i,
  /\bexceeded expectations\b/i,
  /\bunderperformed\b/i,
  /\bon track\b/i,
  /\boff track\b/i,
  /\bgraft survival\s*%/i,
  /\bsurvival\s*\d+\s*%/i,
  /\bgrowth\s*\d+\s*%/i,
  /\bprediction accuracy\b/i,
  /\bprojection accuracy\b/i,
  /\baccuracy\s*\d+\s*%/i,
  /\b\d+\s*%\s*accuracy\b/i,
  /\bsuccess score\b/i,
  /\bfailure score\b/i,
  /\bexcellent outcome\b/i,
  /\bpoor outcome\b/i,
  /\bguaranteed result\b/i,
  /\boverall success\b/i,
  /\bresult score\b/i,
];

export function findUnsafeLongitudinalReviewClaims(
  text: string
): LongitudinalReviewSafetyViolation[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const hits: LongitudinalReviewSafetyViolation[] = [];
  for (const re of REPORT_EXTRA_FORBIDDEN) {
    if (re.test(t)) {
      hits.push({ source: "report", text: t, pattern: re.source });
    }
  }
  return hits;
}

export function assertPatientSafeLongitudinalReviewTexts(
  texts: Array<string | null | undefined>
): { ok: true } | { ok: false; violations: LongitudinalReviewSafetyViolation[] } {
  const violations: LongitudinalReviewSafetyViolation[] = [];
  for (const raw of texts) {
    if (raw == null || !String(raw).trim()) continue;
    violations.push(...findUnsafeLongitudinalReviewClaims(String(raw)));
  }
  if (violations.length) return { ok: false, violations };
  return { ok: true };
}

/**
 * Fail-closed validation of frozen snapshot prose before render.
 * Does not regenerate or rewrite content.
 */
export function validateFrozenInputsForLongitudinalReview(args: {
  projectionTexts: Array<string | null | undefined>;
  observationTexts: Array<string | null | undefined>;
  comparisonTexts: Array<string | null | undefined>;
}): { ok: true } | { ok: false; reason: string } {
  const proj = assertPatientSafeProjectionText(args.projectionTexts);
  if (!proj.ok) {
    return {
      ok: false,
      reason: `Projection failed 1B safety validation before report render: ${proj.violations[0]?.pattern ?? "unsafe"}`,
    };
  }
  const obs = assertPatientSafeLongitudinalObservation(args.observationTexts);
  if (!obs.ok) {
    return {
      ok: false,
      reason: `Observation failed 1E safety validation before report render: ${obs.violations[0]?.pattern ?? "unsafe"}`,
    };
  }
  const cmp = assertPatientSafeComparisonText(args.comparisonTexts);
  if (!cmp.ok) {
    return {
      ok: false,
      reason: `Comparison failed 1F safety validation before report render: ${cmp.violations[0]?.pattern ?? "unsafe"}`,
    };
  }
  return { ok: true };
}

/** Allowed patient-facing status labels (1G presentation). */
export const ALLOWED_PATIENT_COMPARISON_LABELS = [
  "Broadly consistent",
  "Partially consistent",
  "Mixed / partially consistent",
  "Different from original projection",
  "Some characteristics differ from the original projection",
  "Not yet assessable",
  "Too early for overall comparison",
  "More evidence needed",
  "More evidence needed for comparison",
] as const;
