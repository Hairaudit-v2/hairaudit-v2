import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPatientUploadConfidenceMessage } from "../src/lib/uploads/patientUploadConfidenceMessages";
import { PATIENT_UPLOAD_COMPRESS_OPTS } from "../src/lib/uploads/patientUploadClient";

describe("patient upload confidence messages", () => {
  it("returns category-specific front hairline message", () => {
    const msg = getPatientUploadConfidenceMessage("patient_current_front");
    assert.match(msg, /front hairline|Photo added|Perfect/i);
    assert.match(msg, /Perfect/i);
  });

  it("falls back to generic encouraging copy for unknown categories", () => {
    const msg = getPatientUploadConfidenceMessage("unknown_slot");
    assert.match(msg, /Excellent|Perfect/i);
    assert.doesNotMatch(msg, /AI|forensic|GPT/i);
  });
});

describe("compressPatientPhoto options", () => {
  it("uses patient-safe compression defaults", () => {
    assert.equal(PATIENT_UPLOAD_COMPRESS_OPTS.maxEdge, 2400);
    assert.ok(PATIENT_UPLOAD_COMPRESS_OPTS.quality >= 0.8);
    assert.ok(PATIENT_UPLOAD_COMPRESS_OPTS.skipBelowBytes > 0);
  });
});
