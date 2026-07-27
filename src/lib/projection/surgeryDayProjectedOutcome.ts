/**
 * HA-PROJECTION-1B — Deterministic builder for SurgeryDayProjectedOutcome.
 *
 * Input contract: canonical SurgeryDayProcedureReconstruction from 1A only.
 * Does not re-read raw uploads, forensic payloads, report summaries, or Supabase rows.
 * No LLM. No PDF / report UI. No persistence.
 */

import {
  deriveProjectionConfidence,
  extractProjectionConfidenceFactors,
} from "./surgeryDayProjectionConfidence";
import {
  buildImmediateDonorLimitation,
  buildProjectedCharacteristics,
  buildProjectionSummary,
  countEligibleDomains,
  mapAssessmentType,
} from "./surgeryDayProjectionRules";
import {
  STANDARD_PROJECTION_ASSUMPTIONS,
  STANDARD_WHAT_CANNOT_YET_BE_DETERMINED,
  assertPatientSafeProjectionText,
  validateProjectedCharacteristic,
} from "./surgeryDayProjectionSafety";
import type {
  PatientSafeProjectedCharacteristic,
  SurgeryDayProjectedOutcome,
  SurgeryDayProcedureReconstruction,
} from "./types";

export type BuildSurgeryDayProjectedOutcomeOptions = {
  /** Extra limitations appended after validation (must be patient-safe). */
  additionalLimitations?: string[];
};

export type BuildSurgeryDayProjectedOutcomeResult =
  | {
      ok: true;
      projectedOutcome: SurgeryDayProjectedOutcome;
    }
  | {
      ok: false;
      reason: string;
      projectedOutcome: null;
    };

function collectOutcomeTexts(o: SurgeryDayProjectedOutcome): string[] {
  const texts: string[] = [
    o.summary ?? "",
    ...o.assumptions,
    ...o.limitations,
    ...o.whatCannotYetBeDetermined,
  ];
  for (const c of o.projectedCharacteristics) {
    texts.push(c.title, c.observation, c.projection, ...c.limitations);
  }
  return texts;
}

function sanitizeCharacteristics(
  drafts: PatientSafeProjectedCharacteristic[]
): PatientSafeProjectedCharacteristic[] {
  const out: PatientSafeProjectedCharacteristic[] = [];
  for (const draft of drafts) {
    const validated = validateProjectedCharacteristic(draft);
    if (!validated.ok) continue;
    out.push({
      domain: draft.domain,
      title: validated.value.title,
      observation: validated.value.observation,
      projection: validated.value.projection,
      confidence: draft.confidence,
      sourceObservationKeys: validated.value.sourceObservationKeys,
      limitations: validated.value.limitations,
    });
  }
  return out;
}

/**
 * Build bounded patient-safe projected outcome from a 1A reconstruction.
 */
export function buildSurgeryDayProjectedOutcome(
  reconstruction: SurgeryDayProcedureReconstruction,
  options?: BuildSurgeryDayProjectedOutcomeOptions
): BuildSurgeryDayProjectedOutcomeResult {
  if (!reconstruction || typeof reconstruction !== "object") {
    return {
      ok: false,
      reason: "SurgeryDayProcedureReconstruction is required.",
      projectedOutcome: null,
    };
  }

  if (
    reconstruction.assessmentType !== "surgery_day_reconstruction" &&
    reconstruction.assessmentType !== "surgery_day_reconstruction_with_baseline"
  ) {
    return {
      ok: false,
      reason: "1B requires a surgery-day reconstruction assessment type from 1A.",
      projectedOutcome: null,
    };
  }

  if (!reconstruction.evidence?.presentRoles?.includes("surgery_day_recipient")) {
    return {
      ok: false,
      reason: "1A reconstruction lacks surgery-day recipient evidence required for projection.",
      projectedOutcome: null,
    };
  }

  const eligibleCount = countEligibleDomains(reconstruction);
  const factors = extractProjectionConfidenceFactors(reconstruction, eligibleCount);
  const projectionConfidence = deriveProjectionConfidence(factors);

  const drafts = buildProjectedCharacteristics(reconstruction, projectionConfidence);
  const projectedCharacteristics = sanitizeCharacteristics(drafts);

  // Fail closed if every draft was unsafe — do not emit empty success prose
  if (drafts.length > 0 && projectedCharacteristics.length === 0) {
    return {
      ok: false,
      reason: "All projected characteristics failed patient-safe language validation.",
      projectedOutcome: null,
    };
  }

  const assessmentType = mapAssessmentType(reconstruction);
  const summary = buildProjectionSummary(
    reconstruction,
    projectedCharacteristics.map((c) => c.domain)
  );

  const limitations = [
    ...reconstruction.evidence.limitations.filter((l) =>
      assertPatientSafeProjectionText([l]).ok
    ),
    ...reconstruction.baseline.limitations.filter((l) =>
      assertPatientSafeProjectionText([l]).ok
    ),
  ];

  const donorLimitation = buildImmediateDonorLimitation(reconstruction);
  if (donorLimitation) limitations.push(donorLimitation);

  if (!reconstruction.baseline.available) {
    limitations.push(
      "No verified preoperative baseline was available, so the extent of change from the patient's original hairline cannot be determined."
    );
  }

  for (const extra of options?.additionalLimitations ?? []) {
    if (assertPatientSafeProjectionText([extra]).ok) limitations.push(extra);
  }

  const uniqueLimitations = [...new Set(limitations.map((l) => l.trim()).filter(Boolean))];

  const projectedOutcome: SurgeryDayProjectedOutcome = {
    assessmentType,
    reconstructionConfidence: reconstruction.evidence.confidence,
    projectionConfidence,
    summary,
    projectedCharacteristics,
    whatCannotYetBeDetermined: [...STANDARD_WHAT_CANNOT_YET_BE_DETERMINED],
    assumptions: [...STANDARD_PROJECTION_ASSUMPTIONS],
    limitations: uniqueLimitations,
  };

  const safety = assertPatientSafeProjectionText(collectOutcomeTexts(projectedOutcome));
  if (!safety.ok) {
    // Fail closed on summary/assumptions — strip unsafe summary rather than ship certainty
    if (projectedOutcome.summary && !assertPatientSafeProjectionText([projectedOutcome.summary]).ok) {
      projectedOutcome.summary = null;
    }
    projectedOutcome.assumptions = projectedOutcome.assumptions.filter(
      (a) => assertPatientSafeProjectionText([a]).ok
    );
    projectedOutcome.limitations = projectedOutcome.limitations.filter(
      (l) => assertPatientSafeProjectionText([l]).ok
    );
    projectedOutcome.whatCannotYetBeDetermined =
      projectedOutcome.whatCannotYetBeDetermined.filter(
        (w) => assertPatientSafeProjectionText([w]).ok
      );

    const retry = assertPatientSafeProjectionText(collectOutcomeTexts(projectedOutcome));
    if (!retry.ok) {
      return {
        ok: false,
        reason: "Projected outcome failed patient-safe language validation.",
        projectedOutcome: null,
      };
    }
  }

  return { ok: true, projectedOutcome };
}
