/**
 * HA-PROJECTION-1A — Prevent accidental future-result / prediction language.
 *
 * Context-sensitive exceptions allow statements about what cannot yet be assessed.
 */

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bwill grow\b/i,
  /\bexpected result\b/i,
  /\blikely result\b/i,
  /\bpredicted result\b/i,
  /\bexcellent outcome\b/i,
  /\bpoor outcome\b/i,
  /\bsuccess probability\b/i,
  /\bgrowth percentage\b/i,
  /\bfinal density\b(?!\s+(cannot|can not|can't|will not|won't))/i,
  /\bshould achieve\b/i,
  /\bwill look\b/i,
  /\bcosmetic result\b/i,
  /\bsurvival rate\b/i,
  /\bgraft survival\b/i,
  /\bpredicted\b/i,
  /\bwill produce\b/i,
  /\bexpected to\b/i,
  /\blikely to (grow|achieve|produce|look)\b/i,
  /\bfinal result\b/i,
  /\bprojected\b/i,
  /\bprediction\b/i,
];

/** Phrases that may mention "final" / density only in a non-claiming way. */
const ALLOWED_EXCEPTION_PATTERNS: readonly RegExp[] = [
  /\bfinal (graft )?growth cannot\b/i,
  /\bfinal density cannot\b/i,
  /\bcannot yet be (assessed|determined|measured|evaluated)\b/i,
  /\bcannot be (assessed|determined|measured) (yet|from|at)\b/i,
  /\bnot (yet )?(assessable|measurable|determinable)\b/i,
  /\bexact .+ cannot\b/i,
  /\bdo not (allow|support) .+ count/i,
];

export type SafetyViolation = {
  text: string;
  pattern: string;
};

export function isAllowedException(text: string): boolean {
  return ALLOWED_EXCEPTION_PATTERNS.some((re) => re.test(text));
}

export function findFutureResultClaims(text: string): SafetyViolation[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  if (isAllowedException(t)) return [];
  const hits: SafetyViolation[] = [];
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(t)) {
      hits.push({ text: t, pattern: re.source });
    }
  }
  return hits;
}

/**
 * Strip or neutralize future-result phrasing. Returns null if the whole string is unusable.
 */
export function sanitizeObservedText(text: string): string | null {
  let t = String(text ?? "").trim();
  if (!t) return null;
  if (isAllowedException(t)) return t;

  // Soft rewrites for common forensic phrasing that implies outcomes
  t = t
    .replace(/\bwill (?:likely\s+)?(?:grow|produce|achieve|look|appear)\b/gi, "appears")
    .replace(/\bexpected (?:result|outcome|density|growth)\b/gi, "visible pattern")
    .replace(/\bpredicted\b/gi, "observed")
    .replace(/\bprojection\b/gi, "observation")
    .replace(/\bsurvival rate\b/gi, "graft condition signals")
    .replace(/\bgraft survival\b/gi, "graft condition signals")
    .replace(/\bfinal result\b/gi, "visible result pattern")
    .replace(/\bexcellent outcome\b/gi, "favourable visible characteristics")
    .replace(/\bpoor outcome\b/gi, "concerning visible characteristics")
    .replace(/\bshould achieve\b/gi, "shows")
    .replace(/\bwill look\b/gi, "appears");

  const remaining = findFutureResultClaims(t);
  if (remaining.length) return null;
  return t;
}

export function assertNoFutureResultClaims(
  texts: Array<string | null | undefined>
): { ok: true } | { ok: false; violations: SafetyViolation[] } {
  const violations: SafetyViolation[] = [];
  for (const t of texts) {
    if (t == null || !String(t).trim()) continue;
    violations.push(...findFutureResultClaims(String(t)));
  }
  if (violations.length) return { ok: false, violations };
  return { ok: true };
}

/** Static limitation strings used by 1A (all must pass the safety check). */
export const SAFE_LIMITATION_TEMPLATES = {
  noBaseline: "No verified preoperative baseline was available.",
  donorAngle: "Donor analysis is limited by image angle.",
  noDensityMeasure: "Exact recipient density cannot be measured from the submitted photographs.",
  noSiteCount: "The supplied images do not allow reliable implantation-site counting.",
  noFinalGrowth: "Final graft growth cannot be assessed at this postoperative stage.",
  noGeometry: "Exact hairline geometry and recipient area in cm² are not measured from these photographs.",
  anyDay0Fallback:
    "Surgery-day recipient evidence relies on a generic any_day0 upload; anatomic specificity is limited.",
} as const;
