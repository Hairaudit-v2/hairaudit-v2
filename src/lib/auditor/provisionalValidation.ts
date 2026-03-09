/**
 * Evidence and consistency validation for provisional high-score cases (>= 90).
 * When satisfied, report can be marked validated_by_evidence or validated_by_consistency.
 */

const COMPLETENESS_THRESHOLD = 85;
const CONSISTENCY_MIN_VALIDATED_CASES = 3;
const CONSISTENCY_MIN_AVG_SCORE = 85;

export type ValidationResult = { pass: boolean; reason?: string };

/** Evidence validation: benchmark eligible, doctor docs, completeness >= 85, no major red flags. */
export function evaluateEvidenceValidation(summary: unknown): ValidationResult {
  const s = (summary ?? {}) as Record<string, unknown>;
  const forensic = (s.forensic_audit ?? s.forensic) as Record<string, unknown> | undefined;
  if (!forensic) return { pass: false, reason: "missing_forensic" };

  const benchmark = forensic.benchmark as { eligible?: boolean } | undefined;
  if (!benchmark?.eligible) return { pass: false, reason: "not_benchmark_eligible" };

  const doctorAnswers = s.doctor_answers as Record<string, unknown> | undefined;
  if (!doctorAnswers || typeof doctorAnswers !== "object" || Object.keys(doctorAnswers).length === 0) {
    return { pass: false, reason: "no_doctor_documentation" };
  }

  const completeness = forensic.completeness_index_v1 as { score?: number } | undefined;
  const completenessScore = Number(completeness?.score ?? 0);
  if (completenessScore < COMPLETENESS_THRESHOLD) {
    return { pass: false, reason: "completeness_below_85" };
  }

  const redFlags = forensic.red_flags as unknown[] | undefined;
  const majorFlags = Array.isArray(redFlags) ? redFlags.filter((f: unknown) => {
    const item = f as { severity?: string };
    return String(item?.severity ?? "").toLowerCase() === "high" || String(item?.severity ?? "").toLowerCase() === "critical";
  }) : [];
  if (majorFlags.length > 0) return { pass: false, reason: "major_integrity_red_flags" };

  return { pass: true };
}

export type ClinicValidatedStats = { validatedCount: number; averageScore: number };

/** Consistency validation: clinic has >= 3 validated cases and avg validated score >= 85. */
export function evaluateConsistencyEligibility(
  clinicValidatedStats: ClinicValidatedStats
): ValidationResult {
  if (clinicValidatedStats.validatedCount < CONSISTENCY_MIN_VALIDATED_CASES) {
    return { pass: false, reason: "insufficient_validated_cases" };
  }
  if (clinicValidatedStats.averageScore < CONSISTENCY_MIN_AVG_SCORE) {
    return { pass: false, reason: "clinic_avg_below_85" };
  }
  return { pass: true };
}
