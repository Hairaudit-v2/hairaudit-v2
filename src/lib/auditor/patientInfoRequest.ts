/**
 * HA-AUDITOR-COMMS-1 — patient-safe auditor information requests.
 */

import { SITE_URL } from "@/lib/constants";

export const PATIENT_INFO_REQUEST_TYPES = [
  "more_photos_needed",
  "procedure_details_needed",
  "medication_history_needed",
  "clinic_or_surgery_details_needed",
  "other",
] as const;

export type PatientInfoRequestType = (typeof PATIENT_INFO_REQUEST_TYPES)[number];

export type PatientInfoRequestState = {
  requestType: PatientInfoRequestType;
  reasonLabel: string;
  sentAt: string | null;
  sanitizedNote: string | null;
};

const PATIENT_SAFE_REQUEST_REASONS: Record<PatientInfoRequestType, string> = {
  more_photos_needed: "Additional photos to support your review",
  procedure_details_needed: "A few more details about your procedure",
  medication_history_needed: "Your medication history or current medications",
  clinic_or_surgery_details_needed: "Clinic or surgery details (date, location, or surgeon name if known)",
  other: "Additional information to help complete your review",
};

/** Words/phrases that must never appear in patient-facing copy. */
const FORBIDDEN_PATIENT_COPY_PATTERN =
  /\b(ai|gpt|forensic|audit\s*os|intelligence\s+engine|precision\s+score|surgical\s+intelligence|platinum\s+tier|gold\s+tier|failed|botched|negligence|malpractice|diagnos(?:is|ed|e))\b/i;

const MAX_AUDITOR_NOTE_LENGTH = 500;

export function isPatientInfoRequestType(value: string): value is PatientInfoRequestType {
  return (PATIENT_INFO_REQUEST_TYPES as readonly string[]).includes(value);
}

export function patientSafeRequestReasonLabel(requestType: PatientInfoRequestType): string {
  return PATIENT_SAFE_REQUEST_REASONS[requestType];
}

export function sanitizeAuditorNoteForPatient(note: string | null | undefined): string | null {
  const trimmed = String(note ?? "").trim();
  if (!trimmed) return null;
  if (FORBIDDEN_PATIENT_COPY_PATTERN.test(trimmed)) return null;
  const clipped = trimmed.slice(0, MAX_AUDITOR_NOTE_LENGTH);
  return clipped.replace(/\s+/g, " ");
}

export function patientInfoRequestEmailContainsForbiddenWording(text: string): boolean {
  return FORBIDDEN_PATIENT_COPY_PATTERN.test(text);
}

export type PatientInfoRequestEmailContent = {
  subject: string;
  text: string;
  html: string;
  secureLink: string;
};

export function buildPatientInfoRequestSecureLink(caseId: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? SITE_URL).replace(/\/+$/, "");
  return `${baseUrl}/cases/${encodeURIComponent(caseId)}`;
}

export function buildPatientInfoRequestEmailContent(args: {
  caseId: string;
  patientName?: string | null;
  requestType: PatientInfoRequestType;
  auditorNote?: string | null;
}): PatientInfoRequestEmailContent {
  const secureLink = buildPatientInfoRequestSecureLink(args.caseId);
  const greeting =
    args.patientName && String(args.patientName).trim()
      ? `Hi ${String(args.patientName).trim()},`
      : "Hi,";
  const requestReason = patientSafeRequestReasonLabel(args.requestType);
  const sanitizedNote = sanitizeAuditorNoteForPatient(args.auditorNote);
  const noteBlock = sanitizedNote ? `\n\n${sanitizedNote}` : "";
  const subject = "More information needed for your HairAudit review";

  const text =
    `${greeting}\n\n` +
    `Thank you for submitting your HairAudit review. Our review team needs a little more information before finalising your report.\n\n` +
    `Requested information:\n${requestReason}${noteBlock}\n\n` +
    `You can securely add the information here:\n${secureLink}\n\n` +
    `Once this is received, your review can continue.\n\n` +
    `Kind regards,\nThe HairAudit Review Team`;

  const noteHtml = sanitizedNote
    ? `<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">${escapeHtml(sanitizedNote)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr><td style="padding: 24px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding: 32px 24px;">
          <p style="margin: 0 0 24px 0; font-size: 15px; color: #4b5563;">${escapeHtml(greeting)}</p>
          <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #111827; line-height: 1.3;">More information needed for your HairAudit review</h1>
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">Thank you for submitting your HairAudit review. Our review team needs a little more information before finalising your report.</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">Requested information:</p>
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">${escapeHtml(requestReason)}</p>
          ${noteHtml}
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
            <tr><td style="border-radius: 6px; background-color: #0891b2;">
              <a href="${escapeHtml(secureLink)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Continue your review</a>
            </td></tr>
          </table>
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">Once this is received, your review can continue.</p>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Kind regards,<br>The HairAudit Review Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html, secureLink };
}

export function extractPatientInfoRequestFromReportSummary(
  summary: unknown
): PatientInfoRequestState | null {
  if (!summary || typeof summary !== "object") return null;
  const auditorReview = (summary as Record<string, unknown>).auditor_review;
  if (!auditorReview || typeof auditorReview !== "object") return null;
  const review = auditorReview as Record<string, unknown>;
  if (!review.needs_more_evidence) return null;

  const requestTypeRaw = String(review.patient_info_request_type ?? "other");
  const requestType = isPatientInfoRequestType(requestTypeRaw) ? requestTypeRaw : "other";
  const reasonFromSummary = String(review.patient_info_request_reason_label ?? "").trim();
  const reasonLabel = reasonFromSummary || patientSafeRequestReasonLabel(requestType);
  const sentAt = (review.patient_info_request_sent_at as string | null | undefined) ?? null;
  const sanitizedNote =
    sanitizeAuditorNoteForPatient(review.patient_info_request_note as string | null | undefined) ?? null;

  return { requestType, reasonLabel, sentAt, sanitizedNote };
}

export function isCaseAwaitingPatientInformation(caseStatus: string | null | undefined): boolean {
  return String(caseStatus ?? "").trim().toLowerCase() === "awaiting_patient_information";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
