/**
 * Structured payload for manual follow-up reminder sends (clinic only).
 * SMS is not a supported channel until a real provider path exists in the app.
 */

import type { FollowupReminderDraft } from "@/lib/audit/followupReminderDraftsFromReadiness";
import type { FollowupTimelineStageId } from "@/lib/audit/followupTimelineFromPatientUploads";
import { followupTimelineStageLabel } from "@/lib/audit/followupTimelineFromPatientUploads";

export const FOLLOWUP_REMINDER_MANUAL_SOURCE = "manual_draft_send" as const;

export type FollowupReminderSendChannel = "email";

/** Row shape returned from `followup_reminder_send_log` (Supabase). */
export type FollowupReminderSendLogRow = {
  id: string;
  case_id: string;
  milestone: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  sent_by_user_id: string;
  sent_at: string;
  source: string;
  draft_schema_version: string;
  delivery_status: string;
  error_message: string | null;
};

/** Channels the app can actually deliver today (Resend email only). */
export const FOLLOWUP_REMINDER_DELIVERABLE_CHANNELS: readonly FollowupReminderSendChannel[] = ["email"];

const MILESTONES: ReadonlySet<string> = new Set<FollowupTimelineStageId>([
  "day1",
  "week1",
  "month3",
  "month6",
  "month9",
  "month12",
]);

const MAX_BODY_LEN = 20_000;
const MAX_SUBJECT_LEN = 500;
const MAX_RECIPIENT_LEN = 320;

export type FollowupReminderSendPayload = {
  caseId: string;
  milestoneId: FollowupTimelineStageId;
  milestoneLabel: string;
  channel: FollowupReminderSendChannel;
  recipient: string;
  subject: string | null;
  body: string;
  draftSchemaVersion: string;
  source: typeof FOLLOWUP_REMINDER_MANUAL_SOURCE;
};

export type ParsedManualSendBody = {
  caseId: string;
  milestoneId: FollowupTimelineStageId;
  channel: FollowupReminderSendChannel;
  recipient: string;
  subject: string | null;
  body: string;
  draftSchemaVersion: string;
};

export function isSupportedFollowupReminderDeliveryChannel(v: string): v is FollowupReminderSendChannel {
  return (FOLLOWUP_REMINDER_DELIVERABLE_CHANNELS as readonly string[]).includes(v);
}

export function clinicUserMaySendFollowupReminder(
  caseClinicId: string | null | undefined,
  userId: string,
  profileRole: string
): boolean {
  return profileRole === "clinic" && caseClinicId != null && String(caseClinicId) === userId;
}

/**
 * Build the send payload from a Stage 10A draft plus staff edits.
 * Patient-facing draft text is the default body; coordinator note is not included.
 */
export function buildFollowupReminderSendPayloadFromDraft(
  draft: FollowupReminderDraft,
  args: {
    caseId: string;
    recipient: string;
    /** If null/empty, a calm default subject is used */
    subject?: string | null;
    /** Plain text; defaults to draft.patientMessageDraft */
    body?: string | null;
  }
): FollowupReminderSendPayload {
  const recipient = String(args.recipient ?? "").trim();
  const bodyRaw = args.body != null && String(args.body).trim() ? String(args.body) : draft.patientMessageDraft;
  const subjectRaw = args.subject != null ? String(args.subject).trim() : "";
  const subject =
    subjectRaw ||
    `HairAudit – optional ${followupTimelineStageLabel(draft.milestoneId)} photos check-in`;

  return {
    caseId: args.caseId,
    milestoneId: draft.milestoneId,
    milestoneLabel: draft.milestoneLabel,
    channel: "email",
    recipient,
    subject,
    body: bodyRaw,
    draftSchemaVersion: draft.metadata.schemaVersion,
    source: FOLLOWUP_REMINDER_MANUAL_SOURCE,
  };
}

export function escapeHtmlForEmail(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal HTML for staff-composed plain-text follow-up reminders. */
/** Prevents overlapping sends from double-clicks (client should hold one instance in a ref). */
export function createSingleFlightLock() {
  let busy = false;
  return {
    tryEnter(): boolean {
      if (busy) return false;
      busy = true;
      return true;
    },
    exit(): void {
      busy = false;
    },
  };
}

export function plainTextToSimpleEmailHtml(text: string): string {
  const safe = escapeHtmlForEmail(text);
  const paragraphs = safe
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111;">${paragraphs}<p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;">— HairAudit (sent by your care team)</p></div>`;
}

export function validateManualFollowupReminderSendBody(
  raw: unknown
): { ok: true; value: ParsedManualSendBody } | { ok: false; error: string } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, error: "Invalid JSON body." };
  }
  const o = raw as Record<string, unknown>;
  const caseId = String(o.caseId ?? "").trim();
  const milestoneId = String(o.milestoneId ?? "").trim();
  const channel = String(o.channel ?? "").trim().toLowerCase();
  const recipient = String(o.recipient ?? "").trim();
  const body = String(o.body ?? "").trim();
  const draftSchemaVersion = String(o.draftSchemaVersion ?? "").trim();
  const subjectIn = o.subject;

  if (!caseId) return { ok: false, error: "caseId is required." };
  if (!MILESTONES.has(milestoneId)) return { ok: false, error: "Invalid milestoneId." };
  if (!isSupportedFollowupReminderDeliveryChannel(channel)) {
    return { ok: false, error: "Only email is supported for follow-up reminders in this environment." };
  }
  if (!recipient) return { ok: false, error: "Recipient email is required." };
  if (recipient.length > MAX_RECIPIENT_LEN) return { ok: false, error: "Recipient is too long." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!body) return { ok: false, error: "Message body cannot be empty." };
  if (body.length > MAX_BODY_LEN) return { ok: false, error: "Message body is too long." };
  if (!draftSchemaVersion) return { ok: false, error: "draftSchemaVersion is required." };

  let subject: string | null = null;
  if (subjectIn != null && String(subjectIn).trim()) {
    const s = String(subjectIn).trim();
    if (s.length > MAX_SUBJECT_LEN) return { ok: false, error: "Subject is too long." };
    subject = s;
  }

  return {
    ok: true,
    value: {
      caseId,
      milestoneId: milestoneId as FollowupTimelineStageId,
      channel,
      recipient,
      subject,
      body,
      draftSchemaVersion,
    },
  };
}
