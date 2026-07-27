/**
 * HA-PROJECTION-1B — Patient-safe projection language validation.
 * Run: pnpm exec tsx --test tests/surgeryDayProjectionSafety.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertPatientSafeProjectionText,
  findUnsafeProjectionClaims,
  validateProjectedCharacteristic,
  STANDARD_PROJECTION_ASSUMPTIONS,
  STANDARD_WHAT_CANNOT_YET_BE_DETERMINED,
} from "@/lib/projection/surgeryDayProjectionSafety";

describe("HA-PROJECTION-1B safety — forbidden language", () => {
  it('rejects "will grow"', () => {
    assert.ok(findUnsafeProjectionClaims("The grafts will grow densely.").length > 0);
  });

  it("rejects survival percentage", () => {
    assert.ok(findUnsafeProjectionClaims("Expected graft survival percentage is high.").length > 0);
    assert.ok(findUnsafeProjectionClaims("90% growth is expected.").length > 0);
  });

  it("rejects success probability", () => {
    assert.ok(findUnsafeProjectionClaims("Probability of success is high.").length > 0);
    assert.ok(findUnsafeProjectionClaims("Success rate is excellent.").length > 0);
  });

  it("rejects exact future density", () => {
    assert.ok(findUnsafeProjectionClaims("Final density will be excellent.").length > 0);
    assert.ok(findUnsafeProjectionClaims("Final density of the frontal zone is assured.").length > 0);
  });

  it("rejects unsupported numeric grafts/cm²", () => {
    assert.ok(findUnsafeProjectionClaims("Final density will be 45 grafts/cm².").length > 0);
    assert.ok(findUnsafeProjectionClaims("Expect 40 FU/cm2.").length > 0);
  });

  it("rejects guaranteed naturalness", () => {
    assert.ok(findUnsafeProjectionClaims("Natural result guaranteed.").length > 0);
    assert.ok(findUnsafeProjectionClaims("The final hairline will look completely natural.").length > 0);
  });

  it('allows "cannot yet be assessed"', () => {
    assert.equal(
      findUnsafeProjectionClaims("The actual final result cannot yet be assessed.").length,
      0
    );
    assert.equal(
      findUnsafeProjectionClaims("Final cosmetic density cannot yet be determined.").length,
      0
    );
  });

  it("unsupported unsafe generated text fails closed via validateProjectedCharacteristic", () => {
    const result = validateProjectedCharacteristic({
      domain: "frontal_framing",
      title: "Frontal framing",
      observation: "Frontal implantation is visible.",
      projection: "The patient will grow a perfect hairline.",
      confidence: "moderate",
      sourceObservationKeys: ["hairline_design"],
      limitations: ["Final hairline softness after maturation cannot yet be assessed."],
    });
    assert.equal(result.ok, false);
  });
});

describe("HA-PROJECTION-1B safety — standard templates", () => {
  it("standard assumptions pass safety", () => {
    const check = assertPatientSafeProjectionText([...STANDARD_PROJECTION_ASSUMPTIONS]);
    assert.equal(check.ok, true, JSON.stringify(check));
  });

  it("what-cannot-yet-be-determined items pass safety", () => {
    const check = assertPatientSafeProjectionText([...STANDARD_WHAT_CANNOT_YET_BE_DETERMINED]);
    assert.equal(check.ok, true, JSON.stringify(check));
  });

  it("allows qualified maturation phrasing", () => {
    assert.equal(
      findUnsafeProjectionClaims(
        "If growth progresses normally, the strongest visual density would be expected in the frontal treatment zone."
      ).length,
      0
    );
  });
});
