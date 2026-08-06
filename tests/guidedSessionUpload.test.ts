/**
 * Phase D guided session upload helpers.
 * Run: npx tsx --test tests/guidedSessionUpload.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  getGuidedSessionInitialView,
  getGuidedSessionPeriodOptions,
  getGuidedSessionRoleSteps,
  missingOptionalGuidedSessionRoles,
  storageCategoryForMilestoneRole,
} from "@/lib/patient/guidedSessionUpload";

test("post-surgery period options use plain language labels", () => {
  const opts = getGuidedSessionPeriodOptions("post_surgery");
  assert.ok(opts.some((o) => o.milestone === "month_6"));
  assert.ok(opts.every((o) => !/month_6/.test(o.label) || o.label.includes("six")));
  assert.ok(opts.every((o) => o.label !== o.milestone));
});

test("pre-surgery only offers before-surgery period", () => {
  const opts = getGuidedSessionPeriodOptions("pre_surgery");
  assert.equal(opts.length, 1);
  assert.equal(opts[0]!.milestone, "pre_surgery");
});

test("month_6 role steps map to postop_month6 storage categories", () => {
  const steps = getGuidedSessionRoleSteps("post_surgery", "month_6");
  const front = steps.find((s) => s.role === "front");
  assert.equal(front?.storageCategory, "postop_month6_front");
  assert.equal(storageCategoryForMilestoneRole("month_6", "donor_rear"), "postop_month6_donor");
});

test("session completeness: required done with optional crown missing", () => {
  const steps = getGuidedSessionRoleSteps("post_surgery", "month_6");
  const photos = [
    { type: "patient_photo:postop_month6_front" },
    { type: "patient_photo:postop_month6_top" },
    { type: "patient_photo:postop_month6_donor" },
  ];
  const view = getGuidedSessionInitialView(photos, steps, true);
  assert.equal(view.mode, "complete");
  const missingOpt = missingOptionalGuidedSessionRoles(photos, steps);
  assert.ok(missingOpt.includes("crown"));
});

test("period mode until patient selects a period", () => {
  const steps = getGuidedSessionRoleSteps("post_surgery", "month_6");
  const view = getGuidedSessionInitialView([], steps, false);
  assert.equal(view.mode, "period");
});
