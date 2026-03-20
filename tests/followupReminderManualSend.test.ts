/**
 * Stage 10B — manual follow-up reminder send (clinic only, no auto-send).
 * Run: npx tsx --test tests/followupReminderManualSend.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildFollowupTimelineFromPatientUploads } from "@/lib/audit/followupTimelineFromPatientUploads";
import { buildFollowupReminderReadinessFromTimeline } from "@/lib/audit/followupReminderReadinessFromTimeline";
import { buildFollowupReminderDraftsFromReadiness } from "@/lib/audit/followupReminderDraftsFromReadiness";
import {
  buildFollowupReminderSendPayloadFromDraft,
  clinicUserMaySendFollowupReminder,
  createSingleFlightLock,
  escapeHtmlForEmail,
  plainTextToSimpleEmailHtml,
  validateManualFollowupReminderSendBody,
} from "@/lib/audit/followupReminderSendPayload";
import { isClinicFollowupManualSendEnabled as isManualSendEnabledFromFeature } from "@/lib/features/enableFollowupReminderManualSend";
import { canSubmit } from "@/lib/auditPhotoSchemas";

const FIXED_ISO = "2020-01-01T00:00:00.000Z";

function firstDraft() {
  const timeline = buildFollowupTimelineFromPatientUploads([]);
  const readiness = buildFollowupReminderReadinessFromTimeline(timeline, { monthsPostOpEstimate: null });
  const drafts = buildFollowupReminderDraftsFromReadiness(readiness, { caseId: "case-1", generatedAt: FIXED_ISO });
  return drafts[0]!;
}

test("manual send flag: opt-in (feature module)", () => {
  assert.equal(isManualSendEnabledFromFeature({}), false);
  assert.equal(
    isManualSendEnabledFromFeature({ NEXT_PUBLIC_ENABLE_CLINIC_FOLLOWUP_MANUAL_SEND: "true" }),
    true
  );
});

test("clinic-only: may send only when profile is clinic and user owns case clinic_id", () => {
  assert.equal(clinicUserMaySendFollowupReminder("u1", "u1", "clinic"), true);
  assert.equal(clinicUserMaySendFollowupReminder("u1", "u2", "clinic"), false);
  assert.equal(clinicUserMaySendFollowupReminder("u1", "u1", "auditor"), false);
  assert.equal(clinicUserMaySendFollowupReminder(null, "u1", "clinic"), false);
});

test("validation: missing recipient and body", () => {
  const badRecipient = validateManualFollowupReminderSendBody({
    caseId: "x",
    milestoneId: "day1",
    channel: "email",
    recipient: "",
    body: "hello",
    draftSchemaVersion: "hairaudit.followup_reminder_draft.v1",
  });
  assert.equal(badRecipient.ok, false);

  const badBody = validateManualFollowupReminderSendBody({
    caseId: "x",
    milestoneId: "day1",
    channel: "email",
    recipient: "a@b.co",
    body: "   ",
    draftSchemaVersion: "hairaudit.followup_reminder_draft.v1",
  });
  assert.equal(badBody.ok, false);
});

test("validation: SMS channel rejected (no provider in product)", () => {
  const r = validateManualFollowupReminderSendBody({
    caseId: "x",
    milestoneId: "week1",
    channel: "sms",
    recipient: "a@b.co",
    body: "hello",
    draftSchemaVersion: "hairaudit.followup_reminder_draft.v1",
  });
  assert.equal(r.ok, false);
});

test("draft selection and payload shaping uses patient draft text", () => {
  const draft = firstDraft();
  const payload = buildFollowupReminderSendPayloadFromDraft(draft, {
    caseId: "case-99",
    recipient: "pat@example.com",
    subject: null,
    body: null,
  });
  assert.equal(payload.caseId, "case-99");
  assert.equal(payload.milestoneId, draft.milestoneId);
  assert.equal(payload.body, draft.patientMessageDraft);
  assert.equal(payload.recipient, "pat@example.com");
  assert.equal(payload.channel, "email");
  assert.equal(payload.draftSchemaVersion, "hairaudit.followup_reminder_draft.v1");
});

test("HTML escaping for email body", () => {
  assert.ok(plainTextToSimpleEmailHtml("<script>").includes("&lt;script&gt;"));
  assert.equal(escapeHtmlForEmail("&"), "&amp;");
});

test("duplicate-click protection: single-flight lock", () => {
  const lock = createSingleFlightLock();
  assert.equal(lock.tryEnter(), true);
  assert.equal(lock.tryEnter(), false);
  lock.exit();
  assert.equal(lock.tryEnter(), true);
});

test("manual send success payload validates", () => {
  const draft = firstDraft();
  const parsed = validateManualFollowupReminderSendBody({
    caseId: "case-z",
    milestoneId: draft.milestoneId,
    channel: "email",
    recipient: "patient@example.com",
    subject: null,
    body: draft.patientMessageDraft,
    draftSchemaVersion: draft.metadata.schemaVersion,
  });
  assert.equal(parsed.ok, true);
});

test("sent history: log row type sanity (fixture)", () => {
  const row = {
    id: "1",
    case_id: "c",
    milestone: "day1",
    channel: "email",
    recipient: "p@test.com",
    subject: "Hi",
    body: "text",
    sent_by_user_id: "u",
    sent_at: FIXED_ISO,
    source: "manual_draft_send",
    draft_schema_version: "hairaudit.followup_reminder_draft.v1",
    delivery_status: "sent",
    error_message: null,
  };
  assert.equal(row.delivery_status, "sent");
  assert.equal(row.source, "manual_draft_send");
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
