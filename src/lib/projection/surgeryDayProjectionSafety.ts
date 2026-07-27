/**
 * HA-PROJECTION-1B — Deterministic patient-safe language validation for projected outcomes.
 *
 * Fail closed: unsafe generated text is rejected, not softened into a success claim.
 * Qualified projection phrasing is allowed; guaranteed / numeric outcome claims are not.
 */

export type ProjectionSafetyViolation = {
  text: string;
  pattern: string;
};

/**
 * Forbidden certainty / fake-precision language.
 * These always fail closed unless the whole string is an explicit denial limitation
 * that matches DENIAL_EXCEPTION_PATTERNS.
 */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bguaranteed\b/i,
  /\bguarantee\b/i,
  /\bwill definitely\b/i,
  /\bwill grow\b/i,
  /\bexpected survival rate\b/i,
  /\bgraft survival percentage\b/i,
  /\bsuccess rate\b/i,
  /\bprobability of success\b/i,
  /\bsuccess probability\b/i,
  /\bfinal density will be\b/i,
  /\bfinal result will be\b/i,
  /\bperfect\b/i,
  /\bexcellent outcome\b/i,
  /\bpoor outcome\b/i,
  /\bsuccessful transplant\b/i,
  /\bfailed transplant\b/i,
  /\bnatural result guaranteed\b/i,
  /\b\d{2,3}\s*%\s*(?:growth|survival|success)\b/i,
  /\b(?:growth|survival|success)\s*(?:rate\s+)?(?:of\s+)?\d{2,3}\s*%/i,
  /\b\d+(?:\.\d+)?\s*(?:grafts?|fu)\s*\/\s*cm(?:²|2)?\b/i,
  /\bfinal density will\b/i,
  /\bwill look completely natural\b/i,
  /\bwill have a strong natural hairline\b/i,
  /\bwill remain bald\b/i,
  /\bwill heal with minimal\b/i,
  /\bshould provide excellent density\b/i,
  /\bgraft survival expectation\b/i,
  /\brecipient surface area\b/i,
  /\bexact (?:implantation[- ]site|donor extraction) count\b/i,
  /\bhairline angle\b/i,
  /\btemporal angle\b/i,
  /\bsymmetry percentage\b/i,
  /\bgrowth percentage\b/i,
  /\bfuture hair calibre\b/i,
  /\bfinal density of\b/i,
  /\bfinal donor depletion\b/i,
];

/**
 * Explicit denial / undetermined phrasing that may mention survival, density, or results
 * without asserting them. Does not waive hard certainty verbs (will grow, guaranteed, …).
 */
const DENIAL_EXCEPTION_PATTERNS: readonly RegExp[] = [
  /\bno statement is being made about actual graft survival\b/i,
  /\bcannot yet be (assessed|determined|measured|evaluated|established)\b/i,
  /\bcannot be (assessed|determined|measured) (yet|from|at)\b/i,
  /\bfinal (?:cosmetic )?(?:appearance|density|result|outcome) cannot\b/i,
  /\bactual (?:final )?result cannot\b/i,
  /\bgraft survival\b.{0,60}\bcannot\b/i,
  /\bcannot.{0,60}\bgraft survival\b/i,
];

const HARD_CERTAINTY_PATTERNS: readonly RegExp[] = [
  /\bguaranteed?\b/i,
  /\bwill definitely\b/i,
  /\bwill grow\b/i,
  /\bwill look completely natural\b/i,
  /\bwill have a strong natural hairline\b/i,
  /\bwill remain bald\b/i,
  /\bwill heal with minimal\b/i,
  /\bexcellent outcome\b/i,
  /\bpoor outcome\b/i,
  /\bsuccess rate\b/i,
  /\bprobability of success\b/i,
  /\bsuccess probability\b/i,
  /\bfinal density will be\b/i,
  /\bfinal result will be\b/i,
  /\bnatural result guaranteed\b/i,
  /\bshould provide excellent density\b/i,
  /\b\d{2,3}\s*%\s*(?:growth|survival|success)\b/i,
  /\b\d+(?:\.\d+)?\s*(?:grafts?|fu)\s*\/\s*cm(?:²|2)?\b/i,
];

function isDenialException(text: string): boolean {
  return DENIAL_EXCEPTION_PATTERNS.some((re) => re.test(text));
}

function hasHardCertainty(text: string): boolean {
  return HARD_CERTAINTY_PATTERNS.some((re) => re.test(text));
}

export function findUnsafeProjectionClaims(text: string): ProjectionSafetyViolation[] {
  const t = String(text ?? "").trim();
  if (!t) return [];

  const hits: ProjectionSafetyViolation[] = [];

  // Hard certainty always fails, even inside otherwise-qualified wording.
  for (const re of HARD_CERTAINTY_PATTERNS) {
    if (re.test(t)) {
      hits.push({ text: t, pattern: re.source });
    }
  }
  if (hits.length) return dedupeViolations(hits);

  // Denial exceptions may mention survival/density without claiming them.
  if (isDenialException(t)) return [];

  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(t)) {
      hits.push({ text: t, pattern: re.source });
    }
  }

  return dedupeViolations(hits);
}

function dedupeViolations(hits: ProjectionSafetyViolation[]): ProjectionSafetyViolation[] {
  const seen = new Set<string>();
  const out: ProjectionSafetyViolation[] = [];
  for (const h of hits) {
    const key = `${h.pattern}::${h.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

export function assertPatientSafeProjectionText(
  texts: Array<string | null | undefined>
): { ok: true } | { ok: false; violations: ProjectionSafetyViolation[] } {
  const violations: ProjectionSafetyViolation[] = [];
  for (const t of texts) {
    if (t == null || !String(t).trim()) continue;
    violations.push(...findUnsafeProjectionClaims(String(t)));
  }
  if (violations.length) return { ok: false, violations };
  return { ok: true };
}

/**
 * Validate a projected characteristic structurally and for language safety.
 * Fail closed: returns null-shaped failure when unsafe or incomplete.
 */
export function validateProjectedCharacteristic(input: {
  domain: string;
  title: string;
  observation: string;
  projection: string;
  confidence: string;
  sourceObservationKeys: string[];
  limitations: string[];
}):
  | {
      ok: true;
      value: {
        domain: string;
        title: string;
        observation: string;
        projection: string;
        confidence: string;
        sourceObservationKeys: string[];
        limitations: string[];
      };
    }
  | {
      ok: false;
      reason: string;
      violations?: ProjectionSafetyViolation[];
    } {
  if (!input.observation?.trim() || !input.projection?.trim()) {
    return { ok: false, reason: "observation and projection are required as separate fields" };
  }
  if (!input.sourceObservationKeys?.length) {
    return { ok: false, reason: "sourceObservationKeys must link to 1A observed features" };
  }
  if (!input.limitations?.length) {
    return { ok: false, reason: "at least one limitation is required" };
  }

  const check = assertPatientSafeProjectionText([
    input.title,
    input.observation,
    input.projection,
    ...input.limitations,
  ]);
  if (!check.ok) {
    return { ok: false, reason: "unsafe projection language", violations: check.violations };
  }

  return {
    ok: true,
    value: {
      domain: input.domain,
      title: input.title.trim(),
      observation: input.observation.trim(),
      projection: input.projection.trim(),
      confidence: input.confidence,
      sourceObservationKeys: [...input.sourceObservationKeys],
      limitations: input.limitations.map((l) => l.trim()).filter(Boolean),
    },
  };
}

/** Standard bounded assumptions applied to every surgery-day projection. */
export const STANDARD_PROJECTION_ASSUMPTIONS: readonly string[] = [
  "Uncomplicated postoperative healing is assumed for any projected visual characteristics.",
  "Transplanted follicles are assumed to progress through normal postoperative shedding and maturation if growth occurs.",
  "No statement is being made about actual graft survival.",
  "Native hair may change independently over time.",
  "Final cosmetic appearance cannot be established from surgery-day images alone.",
];

/** Explicit undetermined items — prominent for later report presentation (1C). */
export const STANDARD_WHAT_CANNOT_YET_BE_DETERMINED: readonly string[] = [
  "Actual graft survival",
  "Final transplanted hair calibre",
  "Final cosmetic density",
  "Final hairline softness after maturation",
  "Final donor appearance after healing",
  "Mature scarring",
  "Ultimate native-hair progression",
  "Long-term cosmetic outcome",
  "Actual month-6 or month-12 result",
];

/** Exported for tests — confirms hard certainty is never waived. */
export function hasHardProjectionCertainty(text: string): boolean {
  return hasHardCertainty(text);
}
