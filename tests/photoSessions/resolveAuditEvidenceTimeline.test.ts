/**
 * HA-PHOTO-TIMELINE-2A — resolveAuditEvidenceTimeline acceptance tests.
 * Run: npx tsx --test tests/photoSessions/resolveAuditEvidenceTimeline.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveSessionSummariesFromUploads,
  type LegacyUploadSignal,
} from "@/lib/photoSessions/deriveSessionsFromUploads";
import { resolveAuditEvidenceTimelineFromUploads } from "@/lib/photoSessions/resolveAuditEvidenceTimeline";
import type { PhotoSessionSummary } from "@/lib/photoSessions/types";

const CASE_ID = "case-timeline-2a";
const PROCEDURE = "2024-01-01T00:00:00.000Z";

function photo(type: string, extra?: Partial<LegacyUploadSignal>): LegacyUploadSignal {
  return {
    id: `u-${type}`,
    type: `patient_photo:${type}`,
    created_at: "2025-01-01T00:00:00.000Z",
    ...extra,
  };
}

function baselineSet(): LegacyUploadSignal[] {
  return [photo("preop_front"), photo("preop_top"), photo("preop_donor_rear")];
}

function monthSet(n: 3 | 6 | 9 | 12, withCrown = false): LegacyUploadSignal[] {
  const donorOrCrown = withCrown ? `postop_month${n}_crown` : `postop_month${n}_donor`;
  return [
    photo(`postop_month${n}_front`),
    photo(`postop_month${n}_top`),
    photo(donorOrCrown),
  ];
}

test("Baseline + month_6 completes readiness without patient_current allocation", () => {
  const uploads = [...baselineSet(), ...monthSet(6)];
  const r = resolveAuditEvidenceTimelineFromUploads({
    caseId: CASE_ID,
    pathway: "post_surgery",
    uploads,
    procedureDate: PROCEDURE,
    monthsSinceBand: "6_9",
  });
  assert.equal(r.readiness, "ready");
  assert.equal(r.latestFollowUpSession?.milestone, "month_6");
  assert.ok(r.baselineSession);
  assert.ok(r.recommendedComparison);
  assert.equal(r.blockingRequirements.length, 0);
  assert.ok(!uploads.some((u) => String(u.type).includes("patient_current")));
});

test("Baseline + month_3 allows audit with early-outcome limitation", () => {
  const r = resolveAuditEvidenceTimelineFromUploads({
    caseId: CASE_ID,
    pathway: "post_surgery",
    uploads: [...baselineSet(), ...monthSet(3)],
    procedureDate: PROCEDURE,
    monthsSinceBand: "3_6",
  });
  assert.equal(r.readiness, "ready_with_limitations");
  assert.equal(r.latestFollowUpSession?.milestone, "month_3");
  assert.ok(r.limitations.some((l) => l.code === "early_outcome_follow_up"));
  assert.equal(r.blockingRequirements.length, 0);
});

test("Baseline + month_12 selects 12 months as latest follow-up", () => {
  const r = resolveAuditEvidenceTimelineFromUploads({
    caseId: CASE_ID,
    pathway: "post_surgery",
    uploads: [...baselineSet(), ...monthSet(12)],
    procedureDate: PROCEDURE,
    monthsSinceBand: "12_plus",
  });
  assert.equal(r.latestFollowUpSession?.milestone, "month_12");
  assert.equal(r.readiness, "ready");
});

test("Multiple follow-up sessions select the latest clinically eligible session", () => {
  const r = resolveAuditEvidenceTimelineFromUploads({
    caseId: CASE_ID,
    pathway: "post_surgery",
    uploads: [...baselineSet(), ...monthSet(3), ...monthSet(12)],
    procedureDate: PROCEDURE,
  });
  assert.equal(r.latestFollowUpSession?.milestone, "month_12");
  assert.ok(r.intermediateSessions.some((s) => s.milestone === "month_3"));
});

test("Newer upload date does not override an older capture date", () => {
  const sessions: PhotoSessionSummary[] = [
    {
      id: "base",
      caseId: CASE_ID,
      milestone: "pre_surgery",
      capturedAt: "2023-12-01T00:00:00.000Z",
      uploadedAt: "2025-06-01T00:00:00.000Z",
      relativeDay: -30,
      milestoneSource: "derived",
      milestoneConfidence: 0.9,
      status: "active",
      rolesPresent: ["front", "top", "donor_rear"],
      imageCount: 3,
    },
    {
      id: "follow-old-capture",
      caseId: CASE_ID,
      milestone: "month_12",
      capturedAt: "2025-01-01T00:00:00.000Z",
      uploadedAt: "2025-01-02T00:00:00.000Z",
      relativeDay: 365,
      milestoneSource: "derived",
      milestoneConfidence: 0.9,
      status: "active",
      rolesPresent: ["front", "top", "donor_rear"],
      imageCount: 3,
    },
    {
      id: "follow-new-upload",
      caseId: CASE_ID,
      milestone: "month_6",
      capturedAt: "2024-07-01T00:00:00.000Z",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      relativeDay: 180,
      milestoneSource: "derived",
      milestoneConfidence: 0.9,
      status: "active",
      rolesPresent: ["front", "top", "donor_rear"],
      imageCount: 3,
    },
  ];

  const r = resolveAuditEvidenceTimelineFromUploads({
    caseId: CASE_ID,
    pathway: "post_surgery",
    uploads: [],
    procedureDate: PROCEDURE,
    sessions,
  });

  assert.equal(r.latestFollowUpSession?.id, "follow-old-capture");
  assert.equal(r.latestFollowUpSession?.milestone, "month_12");
});

test("Pre-surgery cases do not require postoperative sessions", () => {
  const r = resolveAuditEvidenceTimelineFromUploads({
    caseId: CASE_ID,
    pathway: "pre_surgery",
    uploads: [
      photo("preop_front"),
      photo("preop_top"),
      photo("preop_donor_rear"),
      photo("preop_left"),
      photo("preop_right"),
    ],
    procedureDate: null,
  });
  assert.equal(r.readiness, "ready");
  assert.equal(r.latestFollowUpSession, null);
  assert.equal(r.blockingRequirements.length, 0);
});

test("Procedure-reconstruction can use surgery-day images without an outcome session", () => {
  const r = resolveAuditEvidenceTimelineFromUploads({
    caseId: CASE_ID,
    pathway: "post_surgery",
    uploads: [...baselineSet(), photo("day0_recipient"), photo("day0_donor")],
    procedureDate: PROCEDURE,
  });
  assert.equal(r.readiness, "ready_with_limitations");
  assert.ok(r.surgeryDaySession);
  assert.ok(r.limitations.some((l) => l.code === "surgery_day_without_outcome"));
  assert.equal(r.blockingRequirements.length, 0);
});

test("No baseline → not_ready with blocking requirement", () => {
  const r = resolveAuditEvidenceTimelineFromUploads({
    caseId: CASE_ID,
    pathway: "post_surgery",
    uploads: monthSet(6),
    procedureDate: PROCEDURE,
    monthsSinceBand: "6_9",
  });
  assert.equal(r.readiness, "not_ready");
  assert.ok(r.blockingRequirements.some((b) => b.code === "baseline_session"));
});

test("Missing crown creates a targeted limitation, not hard failure when donor present", () => {
  const r = resolveAuditEvidenceTimelineFromUploads({
    caseId: CASE_ID,
    pathway: "post_surgery",
    uploads: [...baselineSet(), ...monthSet(6, false)],
    procedureDate: PROCEDURE,
    monthsSinceBand: "6_9",
  });
  assert.notEqual(r.readiness, "not_ready");
  // Crown is optional when donor_rear is present.
  const crownLim = r.limitations.find((l) => l.code === "missing_optional_role" && l.role === "crown");
  assert.ok(crownLim);
  assert.match(crownLim!.message, /crown/i);
});

test("deriveSessions never emits a current milestone", () => {
  const sessions = deriveSessionSummariesFromUploads(
    [
      photo("patient_current_front"),
      photo("patient_current_top"),
      photo("patient_current_donor_rear"),
    ],
    { caseId: CASE_ID, monthsSinceBand: "6_9", procedureDate: PROCEDURE }
  );
  assert.ok(sessions.every((s) => (s.milestone as string) !== "current"));
  assert.ok(sessions.some((s) => s.milestone === "month_6"));
});
