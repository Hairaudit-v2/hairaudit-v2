/**
 * Email notifications via Resend.
 * Set RESEND_API_KEY and NOTIFICATION_FROM_EMAIL in env.
 * If RESEND_API_KEY is missing, logs to console instead.
 */

import { SITE_URL } from "@/lib/constants";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL ?? "noreply@hairaudit.com";
const AUDITOR_EMAIL = process.env.AUDITOR_NOTIFICATION_EMAIL ?? "auditor@hairaudit.com";

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<boolean> {
  const recipients = Array.isArray(to) ? to : [to];

  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set - would have sent:", { to: recipients, subject });
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipients,
        subject,
        html,
        text: text ?? html.replace(/<[^>]*>/g, ""),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Resend failed:", res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] Send failed:", e);
    return false;
  }
}

export async function notifyPatientAuditFailed(caseId: string, patientEmail: string, errorMessage: string): Promise<boolean> {
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    : `${SITE_URL}/dashboard`;

  return sendEmail({
    to: patientEmail,
    subject: "HairAudit: Report generation delayed",
    html: `
      <p>We're sorry, but the automated audit for your case could not be completed.</p>
      <p><strong>Case ID:</strong> ${caseId}</p>
      <p><strong>Reason:</strong> ${escapeHtml(errorMessage)}</p>
      <p>Our team has been notified and a human auditor will review your case. You can check your dashboard for updates.</p>
      <p><a href="${dashboardUrl}">Go to Dashboard</a></p>
      <p>— HairAudit</p>
    `,
  });
}

export async function notifyAuditorAuditFailed(caseId: string, errorMessage: string): Promise<boolean> {
  const casesUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/cases/${caseId}`
    : `${SITE_URL}/cases/${caseId}`;

  return sendEmail({
    to: AUDITOR_EMAIL,
    subject: `[HairAudit] Audit failed – Case ${caseId} needs manual review`,
    html: `
      <p>The automated audit for case <strong>${escapeHtml(caseId)}</strong> failed after retries.</p>
      <p><strong>Error:</strong> ${escapeHtml(errorMessage)}</p>
      <p>Please complete a manual audit.</p>
      <p><a href="${casesUrl}">Open case</a></p>
      <p>— HairAudit</p>
    `,
  });
}

export type NotifyPatientReportReadyParams = {
  to: string;
  caseId: string;
  /** Optional patient first name for greeting */
  firstName?: string | null;
};

/**
 * Send "Your HairAudit report is ready" email when a case successfully completes.
 * Call only after report is complete and PDF is available; use idempotency (e.g. report_ready_email_sent_at) to avoid duplicates.
 */
export async function notifyPatientReportReady({
  to,
  caseId,
  firstName,
}: NotifyPatientReportReadyParams): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? SITE_URL;
  const dashboardUrl = `${baseUrl}/dashboard/patient`;
  const caseUrl = `${baseUrl}/cases/${escapeHtml(caseId)}`;

  const greeting = firstName && String(firstName).trim() ? `Hi ${escapeHtml(String(firstName).trim())},` : "Hi,";
  const caseLine =
    caseId ? `<p><strong>Case reference:</strong> ${escapeHtml(caseId)}</p>` : "";

  return sendEmail({
    to,
    subject: "Your HairAudit report is ready",
    html: `
      <p>${greeting}</p>
      <p>Your review has been completed and your report is now available securely in your HairAudit dashboard.</p>
      ${caseLine}
      <p>You can view and download your report from your dashboard.</p>
      <p><a href="${dashboardUrl}">Go to Dashboard</a></p>
      <p>Or open your case directly: <a href="${caseUrl}">View case &amp; report</a></p>
      <p>— HairAudit</p>
    `,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
