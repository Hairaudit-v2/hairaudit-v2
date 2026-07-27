/**
 * HA-PROJECTION-1F — Comparison safety.
 * Run: pnpm exec tsx --test tests/projectionComparisonSafety.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assertPatientSafeComparisonText,
  findUnsafeComparisonClaims,
  isAllowedComparisonVocabulary,
  sanitizeComparisonText,
} from "@/lib/projection/projectionComparisonSafety";

describe("HA-PROJECTION-1F safety", () => {
  it('20. "successful transplant" rejected', () => {
    assert.ok(findUnsafeComparisonClaims("This was a successful transplant").length);
  });

  it('21. "better than expected" rejected', () => {
    assert.ok(findUnsafeComparisonClaims("Result is better than expected").length);
  });

  it('22. "worse than projected" rejected', () => {
    assert.ok(findUnsafeComparisonClaims("Appearance is worse than projected").length);
  });

  it("23. survival percentage rejected", () => {
    assert.ok(findUnsafeComparisonClaims("Survival rate is 85%").length);
    assert.ok(findUnsafeComparisonClaims("Estimated 80% survival").length);
  });

  it("24. accuracy percentage rejected", () => {
    assert.ok(findUnsafeComparisonClaims("Projection accuracy is 90%").length);
    assert.ok(findUnsafeComparisonClaims("92% accuracy").length);
  });

  it('25. "consistent" allowed', () => {
    const text =
      "Observed characteristics are consistent with the projected frontal framing pattern.";
    assert.equal(findUnsafeComparisonClaims(text).length, 0);
    assert.equal(assertPatientSafeComparisonText([text]).ok, true);
    assert.equal(isAllowedComparisonVocabulary(text), true);
  });

  it('26. "not yet assessable" allowed', () => {
    const text =
      "At this stage density distribution is not yet assessable against the original projection.";
    assert.equal(findUnsafeComparisonClaims(text).length, 0);
    assert.equal(assertPatientSafeComparisonText([text]).ok, true);
  });

  it("allows differs from / broadly aligns / insufficient evidence", () => {
    const texts = [
      "The observed density pattern differs from the original projected distribution.",
      "Frontal framing broadly aligns with the surgery-day projection.",
      "There is insufficient evidence to evaluate transition characteristics.",
      "Final maturation cannot yet be determined from these images.",
    ];
    for (const t of texts) {
      assert.equal(findUnsafeComparisonClaims(t).length, 0, t);
    }
  });

  it("sanitize softens then fails remaining hard claims", () => {
    const softened = sanitizeComparisonText("This is a successful transplant");
    assert.ok(softened);
    assert.equal(findUnsafeComparisonClaims(softened!).length, 0);

    // Numeric accuracy claims remain hard-forbidden after soft rewrite attempts
    const stillBad = sanitizeComparisonText("Forecast shows 92% accuracy");
    assert.equal(stillBad, null);
  });
});
