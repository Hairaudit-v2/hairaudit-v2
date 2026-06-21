/**
 * HA-UX-6A — guided patient upload wizard helpers.
 * Run: npx tsx --test tests/guidedPatientUploadWizard.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessGuidedWizardStep,
  getGuidedWizardInitialView,
  getGuidedWizardMaxAccessibleStepIndex,
  getGuidedWizardRequiredKeys,
  isGuidedWizardStepComplete,
  resolveGuidedWizardStepAfterUpload,
} from "../src/lib/patient/guidedPatientUploadWizard";
import {
  computePathwayUploadProgress,
  isPathwayRequiredUploadComplete,
  recommendedPhotoKeys,
  optionalPhotoKeys,
} from "../src/lib/patient/patientReviewPathway";

const PRE_REQUIRED = getGuidedWizardRequiredKeys("pre_surgery");
const POST_REQUIRED = getGuidedWizardRequiredKeys("post_surgery");

function photo(type: string) {
  return { type: `patient_photo:${type}` };
}

describe("guided patient upload wizard", () => {
  it("pre-surgery required order matches pathway pack (5 planning views)", () => {
    assert.equal(PRE_REQUIRED.length, 5);
    assert.deepEqual(PRE_REQUIRED, [
      "preop_front",
      "preop_left",
      "preop_right",
      "preop_top",
      "preop_donor_rear",
    ]);
  });

  it("post-surgery required order matches pathway pack (5 audit views)", () => {
    assert.equal(POST_REQUIRED.length, 5);
    assert.deepEqual(POST_REQUIRED, [
      "preop_front",
      "current_recipient_closeup",
      "preop_top",
      "preop_donor_rear",
      "preop_donor_closeup",
    ]);
  });

  it("starts at first missing required slot for pre-surgery", () => {
    const photos = [photo("preop_front")];
    const view = getGuidedWizardInitialView("pre_surgery", photos);
    assert.deepEqual(view, { mode: "step", stepIndex: 1 });
    assert.equal(canAccessGuidedWizardStep(0, "pre_surgery", photos), true);
    assert.equal(canAccessGuidedWizardStep(1, "pre_surgery", photos), true);
    assert.equal(canAccessGuidedWizardStep(2, "pre_surgery", photos), false);
  });

  it("starts at first missing required slot for post-surgery", () => {
    const photos = [photo("preop_front"), photo("current_recipient_closeup")];
    const view = getGuidedWizardInitialView("post_surgery", photos);
    assert.deepEqual(view, { mode: "step", stepIndex: 2 });
  });

  it("shows completion when all required slots exist", () => {
    const preComplete = PRE_REQUIRED.map((k) => photo(k));
    assert.deepEqual(getGuidedWizardInitialView("pre_surgery", preComplete), { mode: "complete" });
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", preComplete), true);

    const postComplete = POST_REQUIRED.map((k) => photo(k));
    assert.deepEqual(getGuidedWizardInitialView("post_surgery", postComplete), { mode: "complete" });
  });

  it("required progress reflects required uploads only", () => {
    const withRecommended = [
      ...PRE_REQUIRED.map((k) => photo(k)),
      photo(recommendedPhotoKeys.pre_surgery[0]),
      photo(optionalPhotoKeys.pre_surgery[0]),
    ];
    const progress = computePathwayUploadProgress("pre_surgery", withRecommended);
    assert.equal(progress.completed, 5);
    assert.equal(progress.total, 5);
    assert.equal(progress.percent, 100);
    assert.equal(progress.recommendedCompleted, 1);
  });

  it("advances view to completion after all required uploads", () => {
    const partial = PRE_REQUIRED.slice(0, 4).map((k) => photo(k));
    assert.deepEqual(resolveGuidedWizardStepAfterUpload("pre_surgery", partial), {
      mode: "step",
      stepIndex: 4,
    });

    const complete = PRE_REQUIRED.map((k) => photo(k));
    assert.deepEqual(resolveGuidedWizardStepAfterUpload("pre_surgery", complete), { mode: "complete" });
  });

  it("max accessible step blocks skipping ahead to incomplete required slots", () => {
    const photos = [photo("preop_front")];
    assert.equal(getGuidedWizardMaxAccessibleStepIndex("pre_surgery", photos), 1);
    assert.equal(isGuidedWizardStepComplete("pre_surgery", photos, 0), true);
    assert.equal(isGuidedWizardStepComplete("pre_surgery", photos, 1), false);
  });

  it("recommended and optional keys are not part of wizard required steps", () => {
    for (const key of recommendedPhotoKeys.pre_surgery) {
      assert.equal(PRE_REQUIRED.includes(key), false);
    }
    for (const key of optionalPhotoKeys.post_surgery) {
      assert.equal(POST_REQUIRED.includes(key), false);
    }
  });

  it("questions route pattern for patient flow", () => {
    const caseId = "case-test-123";
    const questionsHref = `/cases/${caseId}/patient/questions`;
    assert.match(questionsHref, /\/cases\/[^/]+\/patient\/questions$/);
  });

  it("continue is only applicable when required uploads are complete", () => {
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
});
