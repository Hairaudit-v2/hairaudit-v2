import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPatientUploadConfidenceMessage } from "../src/lib/uploads/patientUploadConfidenceMessages";
import { PATIENT_UPLOAD_COMPRESS_OPTS } from "../src/lib/uploads/patientUploadClient";
import {
  getGuidedWizardInitialView,
  getGuidedWizardRequiredKeys,
} from "../src/lib/patient/guidedPatientUploadWizard";
import { isPathwayRequiredUploadComplete } from "../src/lib/patient/patientReviewPathway";
import en from "../src/lib/i18n/translations/en.json";

const PRE_REQUIRED = getGuidedWizardRequiredKeys("pre_surgery");

function photo(type: string) {
  return { type: `patient_photo:${type}` };
}

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

describe("guided upload completion UX (HA-UX-6C)", () => {
  it("completion i18n uses lighter continue copy", () => {
    assert.equal(en.patient.upload.completion.continue, "Almost done — Continue");
    assert.match(en.patient.upload.completion.subcopy, /improve report accuracy/i);
  });

  it("optional reveal copy frames extra photos as helpful, not required", () => {
    assert.match(en.patient.upload.optionalReveal.subcopy, /completely optional/i);
    assert.match(en.patient.upload.extraPhotos.addButton, /Add Extra Photos/i);
    assert.doesNotMatch(en.patient.upload.extraPhotos.addButton, /required/i);
  });

  it("continue is only applicable when all required uploads exist", () => {
    const incomplete = [photo("preop_front")];
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", incomplete), false);
    assert.deepEqual(getGuidedWizardInitialView("pre_surgery", incomplete), {
      mode: "step",
      stepIndex: 1,
    });

    const complete = PRE_REQUIRED.map((k) => photo(k));
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", complete), true);
    assert.deepEqual(getGuidedWizardInitialView("pre_surgery", complete), { mode: "complete" });
  });

  it("optional sections stay out of required wizard flow until completion", () => {
    const partial = PRE_REQUIRED.slice(0, 3).map((k) => photo(k));
    const view = getGuidedWizardInitialView("pre_surgery", partial);
    assert.equal(view.mode, "step");
    assert.notEqual(view.mode, "complete");
  });
});
