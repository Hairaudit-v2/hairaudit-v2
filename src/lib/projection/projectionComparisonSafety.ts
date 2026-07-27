/**
 * HA-PROJECTION-1F — Comparison safety for projected vs observed language.
 *
 * Blocks success/failure, better/worse-than-expected, survival/accuracy %, rankings.
 * Allows consistency vocabulary and descriptive comparison phrasing.
 */

export type ComparisonSafetyViolation = {
  text: string;
  pattern: string;
};

const HARD_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bsuccessful transplant\b/i,
  /\bfailed transplant\b/i,
  /\btransplant (was )?(a )?success\b/i,
  /\btransplant (was )?(a )?failure\b/i,
  /\bbetter than (expected|projected|predicted)\b/i,
  /\bworse than (expected|projected|predicted)\b/i,
  /\bexceeded (expectations|projection|projected)\b/i,
  /\boutperformed (the )?projection\b/i,
  /\bunderperformed\b/i,
  /\bsuperior result\b/i,
  /\bon track\b/i,
  /\boff track\b/i,
  /\bsurvival rate\b/i,
  /\bgrowth percentage\b/i,
  /\bgrowth\s*\d+\s*%/i,
  /\bsurvival\s*\d+\s*%/i,
  /\b\d+\s*%\s*(growth|survival|success|accuracy)\b/i,
  /\baccuracy\s*(percentage|%|rate)\b/i,
  /\bprojection accuracy\b/i,
  /\b\d+\s*%\s*accuracy\b/i,
  /\baccuracy\s*\d+\s*%/i,
  /\bguaranteed\b/i,
  /\bexcellent outcome\b/i,
  /\bpoor outcome\b/i,
  /\bfinal result\b/i,
  /\bpermanent damage\b/i,
  /\bprojection achieved\b/i,
  /\bmissed (the )?projection\b/i,
];

const ALLOWED_PHRASE_HINTS: readonly RegExp[] = [
  /\bconsistent\b/i,
  /\bpartially consistent\b/i,
  /\bdivergent\b/i,
  /\bnot yet assessable\b/i,
  /\binsufficient evidence\b/i,
  /\bbroadly aligns\b/i,
  /\bdiffers from\b/i,
  /\bcannot yet be determined\b/i,
  /\bappears\b/i,
  /\bobserved\b/i,
  /\bvisible\b/i,
];

export function findUnsafeComparisonClaims(text: string): ComparisonSafetyViolation[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const hits: ComparisonSafetyViolation[] = [];
  for (const re of HARD_FORBIDDEN_PATTERNS) {
    if (re.test(t)) {
      hits.push({ text: t, pattern: re.source });
    }
  }
  return hits;
}

export function assertPatientSafeComparisonText(
  texts: Array<string | null | undefined>
): { ok: true } | { ok: false; violations: ComparisonSafetyViolation[] } {
  const violations: ComparisonSafetyViolation[] = [];
  for (const raw of texts) {
    if (raw == null || !String(raw).trim()) continue;
    violations.push(...findUnsafeComparisonClaims(String(raw)));
  }
  if (violations.length) return { ok: false, violations };
  return { ok: true };
}

/** Soften accidental evaluative phrasing; return null if still unsafe. */
export function sanitizeComparisonText(text: string): string | null {
  let t = String(text ?? "").trim();
  if (!t) return null;

  t = t
    .replace(/\bsuccessful transplant\b/gi, "visible transplant appearance")
    .replace(/\bfailed transplant\b/gi, "visible transplant appearance")
    .replace(/\bbetter than (?:expected|projected|predicted)\b/gi, "differs from the original projection")
    .replace(/\bworse than (?:expected|projected|predicted)\b/gi, "differs from the original projection")
    .replace(/\bexceeded (?:expectations|projection|projected)\b/gi, "differs from the original projection")
    .replace(/\boutperformed (?:the )?projection\b/gi, "differs from the original projection")
    .replace(/\bunderperformed\b/gi, "differs from the original projection")
    .replace(/\bon track\b/gi, "assessable at this stage")
    .replace(/\boff track\b/gi, "assessable at this stage")
    .replace(/\bexcellent outcome\b/gi, "visible characteristics")
    .replace(/\bpoor outcome\b/gi, "visible characteristics")
    .replace(/\bfinal result\b/gi, "visible appearance at this stage")
    .replace(/\bpermanent damage\b/gi, "visible variation")
    .replace(/\bguaranteed\b/gi, "observed")
    .replace(/\bsurvival rate\b/gi, "visible graft signals")
    .replace(/\bgrowth percentage\b/gi, "visible growth appearance")
    .replace(/\bprojection accuracy(?:\s*percentage)?\b/gi, "projection comparison")
    .replace(/\baccuracy percentage\b/gi, "comparison status")
    .replace(/\bsuperior result\b/gi, "visible appearance");

  if (findUnsafeComparisonClaims(t).length) return null;
  return t;
}

export function isAllowedComparisonVocabulary(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (findUnsafeComparisonClaims(t).length) return false;
  return ALLOWED_PHRASE_HINTS.some((re) => re.test(t));
}
