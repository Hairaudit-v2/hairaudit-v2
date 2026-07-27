/**
 * FI-OUTCOME-INTELLIGENCE-1C — Status + next-action tests.
 * Run: pnpm exec tsx --test tests/longitudinalCaptureStatus.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  deriveMilestoneStatus,
  deriveNextAction,
} from "@/lib/outcomeIntelligence/longitudinalCaptureDto";

const WINDOW = {
  windowStart: "2025-06-15",
  windowEnd: "2025-08-14",
};

describe("FI-OUTCOME-INTELLIGENCE-1C status", () => {
  it("8. before window → future", () => {
    const r = deriveMilestoneStatus({
      nowDate: "2025-05-01",
      ...WINDOW,
      requiredSatisfied: false,
      anyEvidencePresent: false,
      observationSnapshotId: null,
    });
    assert.equal(r.status, "future");
  });

  it("9. in window/no evidence → due", () => {
    const r = deriveMilestoneStatus({
      nowDate: "2025-07-15",
      ...WINDOW,
      requiredSatisfied: false,
      anyEvidencePresent: false,
      observationSnapshotId: null,
    });
    assert.equal(r.status, "due");
  });

  it("10. partial evidence → evidence_incomplete", () => {
    const r = deriveMilestoneStatus({
      nowDate: "2025-07-15",
      ...WINDOW,
      requiredSatisfied: false,
      anyEvidencePresent: true,
      observationSnapshotId: null,
    });
    assert.equal(r.status, "evidence_incomplete");
  });

  it("11. required evidence complete → ready_for_review", () => {
    const r = deriveMilestoneStatus({
      nowDate: "2025-07-15",
      ...WINDOW,
      requiredSatisfied: true,
      anyEvidencePresent: true,
      observationSnapshotId: null,
    });
    assert.equal(r.status, "ready_for_review");
  });

  it("12. 1E observation exists → observed", () => {
    const r = deriveMilestoneStatus({
      nowDate: "2025-07-15",
      ...WINDOW,
      requiredSatisfied: false,
      anyEvidencePresent: false,
      observationSnapshotId: "obs-1",
    });
    assert.equal(r.status, "observed");
  });

  it("13. past window/no evidence → missed", () => {
    const r = deriveMilestoneStatus({
      nowDate: "2025-09-01",
      ...WINDOW,
      requiredSatisfied: false,
      anyEvidencePresent: false,
      observationSnapshotId: null,
    });
    assert.equal(r.status, "missed");
  });

  it("late required-complete after window → ready_for_review + late flag", () => {
    const r = deriveMilestoneStatus({
      nowDate: "2025-09-01",
      ...WINDOW,
      requiredSatisfied: true,
      anyEvidencePresent: true,
      observationSnapshotId: null,
    });
    assert.equal(r.status, "ready_for_review");
    assert.equal(r.lateEvidencePresent, true);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1C next actions", () => {
  const caseId = "case-1";

  it("33. future → wait", () => {
    const a = deriveNextAction({
      status: "future",
      stage: "month_6",
      caseId,
      reviewAvailable: false,
      missingRequiredCount: 3,
    });
    assert.equal(a.type, "wait");
    assert.match(a.label, /scheduled/i);
  });

  it("34. due → upload", () => {
    const a = deriveNextAction({
      status: "due",
      stage: "month_6",
      caseId,
      reviewAvailable: false,
      missingRequiredCount: 3,
    });
    assert.equal(a.type, "upload_followup_images");
    assert.ok(a.href?.includes("/patient/photos"));
  });

  it("35. incomplete → complete photos", () => {
    const a = deriveNextAction({
      status: "evidence_incomplete",
      stage: "month_6",
      caseId,
      reviewAvailable: false,
      missingRequiredCount: 2,
    });
    assert.equal(a.type, "complete_followup_images");
    assert.match(a.label, /Add 2 remaining/);
  });

  it("36. ready → wait for review", () => {
    const a = deriveNextAction({
      status: "ready_for_review",
      stage: "month_6",
      caseId,
      reviewAvailable: false,
      missingRequiredCount: 0,
    });
    assert.equal(a.type, "wait_for_review");
  });

  it("37. observed + review available → view review", () => {
    const a = deriveNextAction({
      status: "observed",
      stage: "month_12",
      caseId,
      reviewAvailable: true,
      missingRequiredCount: 0,
    });
    assert.equal(a.type, "view_review");
    assert.match(a.label, /complete/i);
  });

  it("missed uses patient-safe wording", () => {
    const a = deriveNextAction({
      status: "missed",
      stage: "month_6",
      caseId,
      reviewAvailable: false,
      missingRequiredCount: 3,
    });
    assert.match(a.label, /not yet completed/i);
    assert.doesNotMatch(a.label, /failed|missed result/i);
  });
});
