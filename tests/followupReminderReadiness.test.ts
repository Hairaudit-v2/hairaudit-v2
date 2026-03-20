/**
 * Stage 9 — follow-up reminder readiness (informational; no outbound messaging).
 * Run: npx tsx --test tests/followupReminderReadiness.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildFollowupTimelineFromPatientUploads } from "@/lib/audit/followupTimelineFromPatientUploads";
import { buildFollowupReminderReadinessFromTimeline } from "@/lib/audit/followupReminderReadinessFromTimeline";
import { isClinicFollowupReminderReadinessEnabled } from "@/lib/features/enableFollowupReminderReadiness";
import { canSubmit } from "@/lib/auditPhotoSchemas";

test("reminder flag: opt-in when env is exactly true", () => {
  assert.equal(isClinicFollowupReminderReadinessEnabled({}), false);
  assert.equal(
    isClinicFollowupReminderReadinessEnabled({ NEXT_PUBLIC_ENABLE_CLINIC_FOLLOWUP_REMINDER_READINESS: "true" }),
    true
  );
});

test("no uploads and unknown months: sequence next + intake hint", () => {
  const timeline = buildFollowupTimelineFromPatientUploads([]);
  const r = buildFollowupReminderReadinessFromTimeline(timeline, { monthsPostOpEstimate: null });
  assert.equal(r.nextRecommendedMilestone, "day1");
  assert.ok(r.summaryLines.some((l) => l.includes("Day 1")));
  assert.ok(r.summaryLines.some((l) => l.toLowerCase().includes("intake")));
  assert.equal(r.calendarContextAvailable, false);
});

test("month 6 post-op but only month12 photo: marks earlier gaps in past window", () => {
  const timeline = buildFollowupTimelineFromPatientUploads([{ type: "patient_photo:postop_month12_front" }]);
  const r = buildFollowupReminderReadinessFromTimeline(timeline, { monthsPostOpEstimate: 6 });
  assert.ok(r.milestonesPastWindow.length > 0);
  assert.ok(r.milestonesPastWindow.includes("day1") || r.summaryLines.join(" ").includes("Day 1"));
});

test("due soon: month ~2.5 without month3 photos", () => {
  const timeline = buildFollowupTimelineFromPatientUploads([{ type: "patient_photo:postop_week1_recipient" }]);
  const r = buildFollowupReminderReadinessFromTimeline(timeline, { monthsPostOpEstimate: 2.6 });
  assert.ok(r.milestonesDueSoon.includes("month3") || r.milestonesPastWindow.includes("month3"));
});

test("all milestones represented → caught-up copy", () => {
  const timeline = buildFollowupTimelineFromPatientUploads([
    { type: "patient_photo:postop_day1_recipient" },
    { type: "patient_photo:postop_week1_donor" },
    { type: "patient_photo:postop_month3_front" },
    { type: "patient_photo:postop_month6_top" },
    { type: "patient_photo:postop_month9_crown" },
    { type: "patient_photo:postop_month12_front" },
  ]);
  const r = buildFollowupReminderReadinessFromTimeline(timeline, { monthsPostOpEstimate: 14 });
  assert.equal(r.allMilestonesDocumented, true);
  assert.ok(r.summaryLines[0]?.includes("all represented"));
});

test("month 12+ with month12 still missing surfaces Month 12 in summary", () => {
  const timeline = buildFollowupTimelineFromPatientUploads([
    { type: "patient_photo:postop_month6_front" },
  ]);
  const r = buildFollowupReminderReadinessFromTimeline(timeline, { monthsPostOpEstimate: 12.5 });
  const joined = r.summaryLines.join(" ");
  assert.ok(/12-month|month 12|Month 12/i.test(joined));
  assert.ok(r.milestonesPastWindow.includes("month12") || /Month 12/i.test(joined));
});

test("canSubmit unchanged", () => {
  const base = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    { type: "patient_photo:preop_donor_rear" },
  ];
  assert.equal(canSubmit("patient", base), true);
});
