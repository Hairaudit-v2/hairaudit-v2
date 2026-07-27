/**
 * HA-PROJECTION-1E — Observation-only safety.
 * Run: pnpm exec tsx --test tests/longitudinalObservationSafety.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assertPatientSafeLongitudinalObservation,
  findUnsafeLongitudinalObservationClaims,
  sanitizeLongitudinalObservationText,
} from "@/lib/projection/longitudinalObservationSafety";

describe("HA-PROJECTION-1E safety", () => {
  it('23. "successful transplant" rejected', () => {
    assert.ok(findUnsafeLongitudinalObservationClaims("This was a successful transplant").length);
  });

  it('24. "better than projected" rejected', () => {
    assert.ok(findUnsafeLongitudinalObservationClaims("Growth is better than projected").length);
  });

  it('25. "on track" rejected', () => {
    assert.ok(findUnsafeLongitudinalObservationClaims("Patient is on track").length);
  });

  it("26. survival percentage rejected", () => {
    assert.ok(findUnsafeLongitudinalObservationClaims("Survival rate looks good").length);
    assert.ok(findUnsafeLongitudinalObservationClaims("Estimated 80% survival").length);
  });

  it("27. growth percentage rejected", () => {
    assert.ok(findUnsafeLongitudinalObservationClaims("Growth percentage is high").length);
    assert.ok(findUnsafeLongitudinalObservationClaims("70% growth observed").length);
  });

  it('28. "cannot yet be determined" allowed', () => {
    const text = "Final maturation cannot yet be determined from these images.";
    assert.equal(findUnsafeLongitudinalObservationClaims(text).length, 0);
    const assertOk = assertPatientSafeLongitudinalObservation([text]);
    assert.equal(assertOk.ok, true);
  });

  it("allows visible / appears / observed phrasing", () => {
    const texts = [
      "Visible coverage appears through the frontal region.",
      "Early growth is observed where image evidence allows.",
      "Density appearance is not clearly visible in this view.",
      "Assessment is image-limited at this stage.",
    ];
    for (const t of texts) {
      assert.equal(findUnsafeLongitudinalObservationClaims(t).length, 0, t);
    }
  });

  it("sanitize softens then still fails hard remaining claims", () => {
    const softened = sanitizeLongitudinalObservationText("This is a successful transplant");
    assert.ok(softened);
    assert.equal(findUnsafeLongitudinalObservationClaims(softened!).length, 0);

    const stillBad = sanitizeLongitudinalObservationText("Forecast accuracy is 90%");
    // "forecast accuracy" is hard-forbidden and may not soft-rewrite cleanly
    assert.equal(stillBad, null);
  });
});
