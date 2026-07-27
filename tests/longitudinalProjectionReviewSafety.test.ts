/**
 * HA-PROJECTION-1G — Longitudinal review safety tests.
 * Run: pnpm exec tsx --test tests/longitudinalProjectionReviewSafety.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assertPatientSafeLongitudinalReviewTexts,
  findUnsafeLongitudinalReviewClaims,
  ALLOWED_PATIENT_COMPARISON_LABELS,
} from "@/lib/reports/longitudinalProjectionReviewSafety";
import {
  mapComparisonStatusLabel,
  mapOverallComparisonLabel,
} from "@/lib/reports/longitudinalProjectionReviewSections";

describe("HA-PROJECTION-1G safety", () => {
  it("31. success/failure language rejected", () => {
    assert.ok(findUnsafeLongitudinalReviewClaims("This was a successful transplant.").length);
    assert.ok(findUnsafeLongitudinalReviewClaims("This was a failed transplant.").length);
    const guard = assertPatientSafeLongitudinalReviewTexts([
      "Overall this is an excellent outcome.",
    ]);
    assert.equal(guard.ok, false);
  });

  it("32. better/worse expected rejected", () => {
    assert.ok(
      findUnsafeLongitudinalReviewClaims("Result is better than expected.").length
    );
    assert.ok(
      findUnsafeLongitudinalReviewClaims("Result is worse than projected.").length
    );
  });

  it("33. survival % rejected", () => {
    assert.ok(findUnsafeLongitudinalReviewClaims("Graft survival 85%.").length);
    assert.ok(findUnsafeLongitudinalReviewClaims("survival 90%").length);
  });

  it("34. accuracy % rejected", () => {
    assert.ok(findUnsafeLongitudinalReviewClaims("Projection accuracy 78%.").length);
    assert.ok(findUnsafeLongitudinalReviewClaims("92% accuracy").length);
  });

  it("35. Broadly consistent allowed", () => {
    const label = mapComparisonStatusLabel("consistent");
    assert.equal(label, "Broadly consistent");
    assert.ok(ALLOWED_PATIENT_COMPARISON_LABELS.includes(label));
    const guard = assertPatientSafeLongitudinalReviewTexts([
      "The frontal framing appears broadly consistent with the original projection.",
    ]);
    assert.equal(guard.ok, true);
  });

  it("36. Different from original projection allowed", () => {
    const label = mapComparisonStatusLabel("divergent");
    assert.equal(label, "Different from original projection");
    assert.ok(ALLOWED_PATIENT_COMPARISON_LABELS.includes(label));
    const overall = mapOverallComparisonLabel("divergent");
    assert.equal(
      overall,
      "Some characteristics differ from the original projection"
    );
    const guard = assertPatientSafeLongitudinalReviewTexts([
      "Different from original projection",
      "Some characteristics differ from the original projection",
    ]);
    assert.equal(guard.ok, true);
  });

  it("rejects on-track / off-track / guaranteed result", () => {
    assert.ok(findUnsafeLongitudinalReviewClaims("Patient is on track.").length);
    assert.ok(findUnsafeLongitudinalReviewClaims("Patient is off track.").length);
    assert.ok(findUnsafeLongitudinalReviewClaims("Guaranteed result.").length);
  });
});
