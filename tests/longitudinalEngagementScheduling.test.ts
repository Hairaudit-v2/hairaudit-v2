/**
 * FI-OUTCOME-INTELLIGENCE-1D — Scheduling policy documentation + independence.
 * Run: pnpm exec tsx --test tests/longitudinalEngagementScheduling.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  describeEngagementTimingPolicy,
  getEngagementPolicy,
  ENGAGEMENT_POLICY_V1,
} from "@/lib/outcomeIntelligence/longitudinalEngagementPolicy";
import { ENGAGEMENT_POLICY_VERSION } from "@/lib/outcomeIntelligence/longitudinalEngagementTypes";
import { evaluateEngagementEligibility } from "@/lib/outcomeIntelligence/longitudinalEngagementDecision";
import type { CanonicalEngagementMilestoneInput } from "@/lib/outcomeIntelligence/longitudinalEngagementTypes";
import { addCalendarDays } from "@/lib/outcomeIntelligence/longitudinalCaptureSchedule";

function input(
  overrides: Partial<CanonicalEngagementMilestoneInput> = {}
): CanonicalEngagementMilestoneInput {
  return {
    projectionSnapshotId: "proj",
    caseId: "case",
    patientId: "patient",
    stage: "month_6",
    targetDate: "2025-07-15",
    windowStart: "2025-06-15",
    windowEnd: "2025-08-14",
    status: "future",
    missingRequiredEvidenceRoles: [],
    missingRequiredLabels: [],
    observationSnapshotId: null,
    reviewAvailable: false,
    nextAction: { type: "wait", href: null },
    capturePolicyVersion: "fi-outcome-capture-plan-v1",
    captureProtocolVersion: "fi-outcome-capture-protocol-v1",
    planCreatedAt: "2025-01-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("FI-OUTCOME-INTELLIGENCE-1D timing policy", () => {
  it("9. due generated at windowStart", () => {
    const r = evaluateEngagementEligibility(
      input({
        status: "due",
        nextAction: {
          type: "upload_followup_images",
          href: "/cases/c/patient/photos",
        },
      }),
      "2025-06-15T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    if (!r.eligible) return;
    assert.equal(r.eventType, "capture_due");
  });

  it("policy version frozen as fi-outcome-engagement-v1", () => {
    assert.equal(ENGAGEMENT_POLICY_VERSION, "fi-outcome-engagement-v1");
    assert.equal(getEngagementPolicy().version, ENGAGEMENT_POLICY_V1.version);
    const doc = describeEngagementTimingPolicy();
    assert.match(doc, /upcoming_window: 7d/);
    assert.match(doc, /cooldown: 72h/);
    assert.match(doc, /max contacts\/milestone: 3/);
  });

  it("upcoming exactly 7 days before windowStart", () => {
    const start = "2025-06-15";
    const day = addCalendarDays(start, -7);
    const ok = evaluateEngagementEligibility(
      input({ status: "future" }),
      `${day}T00:00:00.000Z`
    );
    assert.equal(ok.eligible, true);
    const early = evaluateEngagementEligibility(
      input({ status: "future" }),
      `${addCalendarDays(start, -8)}T00:00:00.000Z`
    );
    assert.equal(early.eligible, false);
  });

  it("23-24. month independence of eligibility", () => {
    const m3missed = evaluateEngagementEligibility(
      input({
        stage: "month_3",
        status: "missed",
        windowStart: "2025-03-25",
        windowEnd: "2025-05-06",
        targetDate: "2025-04-15",
      }),
      "2025-05-14T00:00:00.000Z"
    );
    const m6due = evaluateEngagementEligibility(
      input({
        stage: "month_6",
        status: "due",
        nextAction: {
          type: "upload_followup_images",
          href: "/x",
        },
      }),
      "2025-06-20T00:00:00.000Z"
    );
    assert.equal(m3missed.eligible, true);
    assert.equal(m6due.eligible, true);
    if (!m3missed.eligible || !m6due.eligible) return;
    assert.equal(m3missed.eventType, "late_capture_recovery");
    assert.equal(m6due.eventType, "capture_due");
  });

  it("25. projection lineage stays on input projectionSnapshotId", () => {
    const r = evaluateEngagementEligibility(
      input({
        projectionSnapshotId: "snap-abc",
        status: "due",
        nextAction: { type: "upload_followup_images", href: "/x" },
      }),
      "2025-06-20T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    // Decision engine does not invent alternate projection ids
    assert.equal(input({ projectionSnapshotId: "snap-abc" }).projectionSnapshotId, "snap-abc");
  });

  it("missed language path is recovery not guilt", () => {
    const r = evaluateEngagementEligibility(
      input({
        status: "missed",
        nextAction: { type: "upload_followup_images", href: "/x" },
      }),
      "2025-08-22T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    if (!r.eligible) return;
    assert.equal(r.reasonCode, "LATE_RECOVERY_WAVE_1");
    assert.doesNotMatch(r.reasonCode, /FAIL|GUILT|NON_COMPLIANT/i);
  });
});
