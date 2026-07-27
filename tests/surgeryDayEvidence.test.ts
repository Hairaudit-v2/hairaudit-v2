/**
 * HA-PROJECTION-1A — Surgery-day evidence role mapping & baseline provenance.
 * Run: pnpm exec tsx --test tests/surgeryDayEvidence.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assessSurgeryDayEvidence,
  resolveProjectionEvidenceRole,
} from "@/lib/projection/surgeryDayEvidence";

describe("HA-PROJECTION-1A evidence mapping", () => {
  it("patient_photo:day0_recipient → surgery_day_recipient", () => {
    const r = resolveProjectionEvidenceRole({ type: "patient_photo:day0_recipient" });
    assert.equal(r.role, "surgery_day_recipient");
    assert.equal(r.isAnyDay0Fallback, false);
  });

  it("clinic immediate-post-op recipient → surgery_day_recipient", () => {
    const r = resolveProjectionEvidenceRole({
      type: "clinic_photo:img_immediate_postop_recipient",
    });
    assert.equal(r.role, "surgery_day_recipient");
  });

  it("doctor immediate-post-op donor → surgery_day_donor", () => {
    const r = resolveProjectionEvidenceRole({
      type: "doctor_photo:img_immediate_postop_donor",
    });
    assert.equal(r.role, "surgery_day_donor");
  });

  it("surgery portal postop_recipient → surgery_day_recipient", () => {
    const r = resolveProjectionEvidenceRole({ type: "surgery_photo:postop_recipient" });
    assert.equal(r.role, "surgery_day_recipient");
  });

  it("any_day0 is fallback only — not preferred role until assess()", () => {
    const r = resolveProjectionEvidenceRole({ type: "patient_photo:any_day0" });
    assert.equal(r.role, null);
    assert.equal(r.isAnyDay0Fallback, true);
  });

  it("true clinic pre-op evidence maps to baseline-eligible preop_front", () => {
    const r = resolveProjectionEvidenceRole(
      { type: "clinic_photo:img_preop_front" },
      { pathway: "post_surgery" }
    );
    assert.equal(r.role, "preop_front");
    assert.equal(r.baselineEligible, true);
  });

  it("surgery portal preop_recipient is baseline-eligible", () => {
    const r = resolveProjectionEvidenceRole(
      { type: "surgery_photo:preop_recipient" },
      { pathway: "post_surgery" }
    );
    assert.equal(r.role, "preop_front");
    assert.equal(r.baselineEligible, true);
  });

  it("post-op upload incorrectly named preop_front does not become baseline", () => {
    const r = resolveProjectionEvidenceRole(
      { type: "patient_photo:preop_front" },
      { pathway: "post_surgery", procedureDate: "2025-01-15" }
    );
    assert.equal(r.role, "preop_front");
    assert.equal(r.baselineEligible, false);
    assert.ok(r.baselineIneligibilityReason);
  });

  it("patient preop_front with capture before procedure_date is baseline-eligible", () => {
    const r = resolveProjectionEvidenceRole(
      {
        type: "patient_photo:preop_front",
        captured_at: "2024-12-01T10:00:00.000Z",
      },
      { pathway: "post_surgery", procedureDate: "2025-01-15" }
    );
    assert.equal(r.baselineEligible, true);
  });

  it("patient_current_front never baseline", () => {
    const r = resolveProjectionEvidenceRole(
      { type: "patient_photo:patient_current_front" },
      { pathway: "pre_surgery" }
    );
    // unmapped current key — not a baseline role
    assert.equal(r.role, null);
  });

  it("pre_surgery pathway preop_* is baseline-eligible", () => {
    const r = resolveProjectionEvidenceRole(
      { type: "patient_photo:preop_front" },
      { pathway: "pre_surgery" }
    );
    assert.equal(r.baselineEligible, true);
  });
});

describe("HA-PROJECTION-1A reconstruction mode", () => {
  it("recipient only → surgery_day_only", () => {
    const a = assessSurgeryDayEvidence({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      context: { pathway: "post_surgery" },
    });
    assert.equal(a.sufficient, true);
    assert.equal(a.mode, "surgery_day_only");
    assert.equal(a.baselineAvailable, false);
  });

  it("recipient + valid pre-op → baseline_plus_surgery_day", () => {
    const a = assessSurgeryDayEvidence({
      uploads: [
        { type: "patient_photo:day0_recipient" },
        { type: "clinic_photo:img_preop_front" },
      ],
      context: { pathway: "post_surgery" },
    });
    assert.equal(a.sufficient, true);
    assert.equal(a.mode, "baseline_plus_surgery_day");
    assert.equal(a.baselineAvailable, true);
  });

  it("no surgery-day recipient → insufficient", () => {
    const a = assessSurgeryDayEvidence({
      uploads: [{ type: "clinic_photo:img_preop_front" }],
      context: {},
    });
    assert.equal(a.sufficient, false);
    assert.equal(a.mode, null);
  });

  it("any_day0 alone can satisfy recipient as fallback", () => {
    const a = assessSurgeryDayEvidence({
      uploads: [{ type: "patient_photo:any_day0" }],
    });
    assert.equal(a.sufficient, true);
    assert.equal(a.usedAnyDay0Fallback, true);
    assert.equal(a.mode, "surgery_day_only");
    assert.equal(a.confidence, "low");
  });

  it("explicit day0 preferred over any_day0 — no fallback flag", () => {
    const a = assessSurgeryDayEvidence({
      uploads: [
        { type: "patient_photo:day0_recipient" },
        { type: "patient_photo:any_day0" },
      ],
    });
    assert.equal(a.usedAnyDay0Fallback, false);
    assert.ok(a.presentRoles.includes("surgery_day_recipient"));
  });

  it("misleading preop_* on post_surgery does not enable baseline mode", () => {
    const a = assessSurgeryDayEvidence({
      uploads: [
        { type: "patient_photo:day0_recipient" },
        { type: "patient_photo:preop_front" },
      ],
      context: { pathway: "post_surgery" },
    });
    assert.equal(a.mode, "surgery_day_only");
    assert.equal(a.baselineAvailable, false);
  });

  it("does not require every pre-op view for baseline mode", () => {
    const a = assessSurgeryDayEvidence({
      uploads: [
        { type: "surgery_photo:postop_recipient" },
        { type: "surgery_photo:preop_donor" },
      ],
    });
    assert.equal(a.mode, "baseline_plus_surgery_day");
    assert.equal(a.baselineRoleCount, 1);
  });
});
