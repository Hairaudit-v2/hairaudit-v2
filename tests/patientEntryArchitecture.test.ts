import { describe, it } from "node:test";
import assert from "node:assert";
import {
  MISSING_PATIENT_REVIEW_PATHWAY_ERROR,
  parseExplicitPatientReviewPathway,
  PATHWAY_CHOOSER_HREF,
} from "../src/lib/patient/patientReviewPathway";

describe("patient entry architecture — explicit pathway parsing", () => {
  it("parseExplicitPatientReviewPathway returns null for missing or invalid values", () => {
    assert.strictEqual(parseExplicitPatientReviewPathway(undefined), null);
    assert.strictEqual(parseExplicitPatientReviewPathway(null), null);
    assert.strictEqual(parseExplicitPatientReviewPathway(""), null);
    assert.strictEqual(parseExplicitPatientReviewPathway("invalid"), null);
  });

  it("parseExplicitPatientReviewPathway accepts only valid pathway tokens", () => {
    assert.strictEqual(parseExplicitPatientReviewPathway("pre_surgery"), "pre_surgery");
    assert.strictEqual(parseExplicitPatientReviewPathway("post_surgery"), "post_surgery");
  });

  it("pathway chooser href targets request-review anchor", () => {
    assert.strictEqual(PATHWAY_CHOOSER_HREF, "/request-review#choose-pathway");
  });

  it("missing pathway error message is patient-safe", () => {
    assert.strictEqual(
      MISSING_PATIENT_REVIEW_PATHWAY_ERROR,
      "Please choose a review type before starting."
    );
  });
});
