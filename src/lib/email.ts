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
 * Template drives return visits with a clear CTA to the case page and reinforces premium positioning.
 */
export async function notifyPatientReportReady({
  to,
  caseId,
  firstName,
}: NotifyPatientReportReadyParams): Promise<boolean> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? SITE_URL).replace(/\/+$/, "");
  const dashboardUrl = `${baseUrl}/dashboard/patient`;
  const caseUrl = caseId ? `${baseUrl}/cases/${escapeHtml(caseId)}` : dashboardUrl;
  const ctaUrl = caseUrl;

  const greeting = firstName && String(firstName).trim() ? `Hi ${escapeHtml(String(firstName).trim())},` : "Hi,";

  const reportReadyEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your HairAudit report is ready</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 24px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #4b5563;">${greeting}</p>
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #111827; line-height: 1.3;">Your HairAudit report is ready</h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #374151;">Your review is complete. Your report includes your case summary, audit findings, and clear next steps — all in one secure place.</p>
              <p style="margin: 0 0 24px 0; font-size: 13px; color: #6b7280; font-style: italic;">Benchmarked against global surgical standards.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: #059669;">
                    <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">View Your Report</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">If the button doesn’t work, copy and paste this link into your browser:</p>
              <p style="margin: 0 0 24px 0; font-size: 13px; color: #059669; word-break: break-all;"><a href="${ctaUrl}" style="color: #059669;">${ctaUrl}</a></p>
              <p style="margin: 0; font-size: 13px; color: #6b7280;">— HairAudit</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const reportReadyEmailText =
    `${greeting}\n\n` +
    `Your HairAudit report is ready\n\n` +
    `Your review is complete. Your report includes your case summary, audit findings, and clear next steps — all in one secure place.\n\n` +
    `Benchmarked against global surgical standards.\n\n` +
    `View Your Report: ${ctaUrl}\n\n` +
    `— HairAudit`;

  return sendEmail({
    to,
    subject: "Your HairAudit report is ready",
    html: reportReadyEmailHtml,
    text: reportReadyEmailText,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
