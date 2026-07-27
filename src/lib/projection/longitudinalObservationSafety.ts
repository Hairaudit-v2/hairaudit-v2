/**
 * HA-PROJECTION-1E — Observation-only safety for longitudinal outcomes.
 *
 * Blocks evaluative / projection-comparison language.
 * Allows descriptive observation phrasing and "cannot yet be determined".
 */

export type LongitudinalSafetyViolation = {
  text: string;
  pattern: string;
};

const HARD_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bsuccessful transplant\b/i,
  /\bfailed transplant\b/i,
  /\bprojection achieved\b/i,
  /\bbetter than (expected|projected|predicted)\b/i,
  /\bworse than (expected|projected|predicted)\b/i,
  /\bon track\b/i,
  /\boff track\b/i,
  /\bsurvival rate\b/i,
  /\bgrowth percentage\b/i,
  /\bgrowth\s*\d+\s*%/i,
  /\bsurvival\s*\d+\s*%/i,
  /\b\d+\s*%\s*(growth|survival|success)\b/i,
  /\bfinal result\b/i,
  /\bexcellent outcome\b/i,
  /\bpoor outcome\b/i,
  /\bguaranteed\b/i,
  /\bpermanent damage\b/i,
  /\bmatched projection\b/i,
  /\bexceeded projection\b/i,
  /\bbelow projection\b/i,
  /\bprojection variance\b/i,
  /\bprojection error\b/i,
  /\bforecast accuracy\b/i,
  /\bpredicted vs actual\b/i,
  /\bbetter than projected\b/i,
  /\bworse than projected\b/i,
  /\bwas the surgery successful\b/i,
  /\btransplant (was )?(a )?success\b/i,
  /\btransplant (was )?(a )?failure\b/i,
];

const ALLOWED_EXCEPTION_PATTERNS: readonly RegExp[] = [
  /\bcannot yet be (assessed|determined|measured|evaluated|observed)\b/i,
  /\bcannot be (assessed|determined|measured|observed) (yet|from|at)\b/i,
  /\bnot (yet )?(clearly )?visible\b/i,
  /\bnot clearly visible\b/i,
  /\bimage[- ]limited\b/i,
  /\bappears\b/i,
  /\bobserved\b/i,
  /\bvisible\b/i,
];

export function isLongitudinalObservationException(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  // Exceptions only waive soft phrasing; hard forbidden always fail.
  return ALLOWED_EXCEPTION_PATTERNS.some((re) => re.test(t));
}

export function findUnsafeLongitudinalObservationClaims(
  text: string
): LongitudinalSafetyViolation[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const hits: LongitudinalSafetyViolation[] = [];
  for (const re of HARD_FORBIDDEN_PATTERNS) {
    if (re.test(t)) {
      hits.push({ text: t, pattern: re.source });
    }
  }
  return hits;
}

/**
 * Soften accidental evaluative phrasing; return null if still unsafe.
 */
export function sanitizeLongitudinalObservationText(text: string): string | null {
  let t = String(text ?? "").trim();
  if (!t) return null;

  t = t
    .replace(/\bsuccessful transplant\b/gi, "visible transplant appearance")
    .replace(/\bfailed transplant\b/gi, "visible transplant appearance")
    .replace(/\bbetter than (?:expected|projected|predicted)\b/gi, "visible appearance")
    .replace(/\bworse than (?:expected|projected|predicted)\b/gi, "visible appearance")
    .replace(/\bon track\b/gi, "visible at this stage")
    .replace(/\boff track\b/gi, "visible at this stage")
    .replace(/\bexcellent outcome\b/gi, "visible characteristics")
    .replace(/\bpoor outcome\b/gi, "visible characteristics")
    .replace(/\bfinal result\b/gi, "visible appearance at this stage")
    .replace(/\bpermanent damage\b/gi, "visible variation")
    .replace(/\bguaranteed\b/gi, "observed")
    .replace(/\bsurvival rate\b/gi, "visible graft signals")
    .replace(/\bgrowth percentage\b/gi, "visible growth appearance")
    .replace(/\bprojection achieved\b/gi, "visible appearance")
    .replace(/\bmatched projection\b/gi, "visible appearance")
    .replace(/\bexceeded projection\b/gi, "visible appearance")
    .replace(/\bbelow projection\b/gi, "visible appearance");

  if (findUnsafeLongitudinalObservationClaims(t).length) return null;
  return t;
}

export function assertPatientSafeLongitudinalObservation(
  texts: Array<string | null | undefined>
): { ok: true } | { ok: false; violations: LongitudinalSafetyViolation[] } {
  const violations: LongitudinalSafetyViolation[] = [];
  for (const raw of texts) {
    if (raw == null || !String(raw).trim()) continue;
    violations.push(...findUnsafeLongitudinalObservationClaims(String(raw)));
  }
  if (violations.length) return { ok: false, violations };
  return { ok: true };
}

/** Stage-aware observational templates (no evaluative language). */
export const STAGE_AWARE_OBSERVATION_TEMPLATES = {
  month_3: {
    frontalSparse:
      "Early visible growth is present through the frontal region where image evidence allows.",
    densityDeveloping:
      "Visible density appearance remains early-stage and cannot yet be fully characterised.",
    donorVariation:
      "Visible donor variation remains present in the submitted image.",
  },
  month_6: {
    frontalDeveloping:
      "Visible frontal coverage appears to be developing based on the submitted follow-up views.",
    densityDeveloping:
      "Visible density appearance is developing; maturation remains incomplete at this stage.",
    donorVariation:
      "Visible donor variation remains present where donor follow-up evidence is available.",
  },
  month_9: {
    frontalMaturing:
      "Visible frontal appearance shows continued maturation where comparable views are available.",
    densityMaturing:
      "Visible density appearance continues to mature based on submitted follow-up evidence.",
    donorAppearance:
      "Visible donor appearance is recorded from the submitted follow-up views.",
  },
  month_12: {
    frontalMature:
      "Visible frontal appearance is recorded at a more mature follow-up stage.",
    densityMature:
      "Visible density appearance is recorded from the submitted month-12 follow-up evidence.",
    donorAppearance:
      "Visible donor appearance is recorded from the submitted follow-up views.",
  },
} as const;
