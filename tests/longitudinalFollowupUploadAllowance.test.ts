/**
 * FI-OUTCOME-INTELLIGENCE-1E — Follow-up upload allowance on submitted cases.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLongitudinalFollowupUploadAllowed,
  isMonthBandedFollowupCategory,
  uploadCategoryForGuidedRole,
  LONGITUDINAL_CAPTURE_WORKFLOW,
} from "../src/lib/outcomeIntelligence/longitudinalFollowupUploadAllowance";

describe("longitudinal follow-up upload allowance", () => {
  it("16-17. month-banded categories always allowed; correct milestone category", () => {
    assert.equal(isMonthBandedFollowupCategory("postop_month6_front"), true);
    assert.equal(
      isLongitudinalFollowupUploadAllowed({ category: "postop_month6_front" }),
      true
    );
    assert.equal(uploadCategoryForGuidedRole("month_6", "followup_front"), "postop_month6_front");
    assert.equal(uploadCategoryForGuidedRole("month_3", "followup_top"), "postop_month3_top");
    assert.equal(
      uploadCategoryForGuidedRole("month_12", "followup_donor_rear"),
      "postop_month12_donor"
    );
  });

  it("shared categories require longitudinal workflow", () => {
    assert.equal(
      isLongitudinalFollowupUploadAllowed({
        category: "current_recipient_closeup",
      }),
      false
    );
    assert.equal(
      isLongitudinalFollowupUploadAllowed({
        category: "current_recipient_closeup",
        captureWorkflow: LONGITUDINAL_CAPTURE_WORKFLOW,
      }),
      true
    );
    assert.equal(
      isLongitudinalFollowupUploadAllowed({
        category: "preop_front",
        captureWorkflow: LONGITUDINAL_CAPTURE_WORKFLOW,
      }),
      false
    );
  });

  it("does not invent new taxonomy namespaces", () => {
    assert.doesNotMatch(
      uploadCategoryForGuidedRole("month_6", "followup_front"),
      /longitudinal_|projection_followup/
    );
  });
});
