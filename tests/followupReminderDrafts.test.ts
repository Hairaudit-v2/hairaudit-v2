/**
 * Stage 10A — follow-up reminder drafts (no auto-send).
 * Run: npx tsx --test tests/followupReminderDrafts.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildFollowupTimelineFromPatientUploads } from "@/lib/audit/followupTimelineFromPatientUploads";
import { buildFollowupReminderReadinessFromTimeline } from "@/lib/audit/followupReminderReadinessFromTimeline";
import { buildFollowupReminderDraftsFromReadiness } from "@/lib/audit/followupReminderDraftsFromReadiness";
import { isClinicFollowupReminderDraftsEnabled } from "@/lib/features/enableFollowupReminderDrafts";
import { canSubmit } from "@/lib/auditPhotoSchemas";

const FIXED_ISO = "2020-01-01T00:00:00.000Z";

function draftsFor(uploads: { type: string }[], months: number | null) {
  const timeline = buildFollowupTimelineFromPatientUploads(uploads);
  const readiness = buildFollowupReminderReadinessFromTimeline(timeline, { monthsPostOpEstimate: months });
  return buildFollowupReminderDraftsFromReadiness(readiness, { caseId: "case-test", generatedAt: FIXED_ISO });
}

test("drafts flag: opt-in", () => {
  assert.equal(isClinicFollowupReminderDraftsEnabled({}), false);
  assert.equal(isClinicFollowupReminderDraftsEnabled({ NEXT_PUBLIC_ENABLE_CLINIC_FOLLOWUP_REMINDER_DRAFTS: "true" }), true);
});

test("no uploads: draft for Day 1 with patient + coordinator + metadata", () => {
  const drafts = draftsFor([], null);
  assert.equal(drafts.length >= 1, true);
  const d = drafts[0]!;
  assert.equal(d.milestoneId, "day1");
  assert.ok(d.patientMessageDraft.includes("optional") || d.patientMessageDraft.includes("Optional"));
  assert.ok(d.coordinatorNote.includes("[HairAudit draft"));
  assert.equal(d.metadata.schemaVersion, "hairaudit.followup_reminder_draft.v1");
  assert.equal(d.metadata.caseId, "case-test");
  assert.equal(d.metadata.generatedAt, FIXED_ISO);
  assert.ok(d.metadata.suggestedChannels.includes("email"));
});

test("due soon: month3 urgency", () => {
  const drafts = draftsFor([{ type: "patient_photo:postop_week1_recipient" }], 2.6);
  const m3 = drafts.find((d) => d.milestoneId === "month3");
  assert.ok(m3);
  assert.equal(m3!.urgency, "due_soon");
});

test("past window: includes urgent copy for missing early milestones", () => {
  const drafts = draftsFor([{ type: "patient_photo:postop_month12_front" }], 6);
  const past = drafts.filter((d) => d.urgency === "past_window");
  assert.ok(past.length >= 1);
  assert.ok(past.some((d) => d.coordinatorNote.toLowerCase().includes("passed")));
});

test("all milestones complete: no drafts", () => {
  const drafts = draftsFor(
    [
      { type: "patient_photo:postop_day1_recipient" },
      { type: "patient_photo:postop_week1_donor" },
      { type: "patient_photo:postop_month3_front" },
      { type: "patient_photo:postop_month6_top" },
      { type: "patient_photo:postop_month9_crown" },
      { type: "patient_photo:postop_month12_front" },
    ],
    14
  );
  assert.equal(drafts.length, 0);
});

test("canSubmit unchanged", () => {
  assert.equal(
    canSubmit("patient", [
      { type: "patient_photo:preop_front" },
      { type: "patient_photo:preop_top" },
      { type: "patient_photo:preop_donor_rear" },
    ]),
    true
  );
});
