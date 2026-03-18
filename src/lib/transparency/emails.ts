import { sendEmail } from "@/lib/email";

type ContributionEmailCommon = {
  to: string[];
  caseId: string;
  contributionUrl: string;
  clinicName?: string | null;
  doctorName?: string | null;
};

function safe(s?: string | null) {
  return String(s ?? "").trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type EmailVariant = "initial" | "reminder" | "final";

const GOLD = "#b8860b";
const CHARCOAL = "#1a1a1a";
const CHARCOAL_MUTED = "#374151";
const BORDER = "#e5e7eb";
const PANEL_BG = "#f9fafb";
const CASE_BOX_BG = "#f3f4f6";

/**
 * Builds the premium clinic outreach HTML email with strong hierarchy,
 * CTA visibility, section panels, and brand-aligned styling.
 */
function buildClinicOutreachHtml(
  input: ContributionEmailCommon,
  variant: EmailVariant
): string {
  const caseId = escapeHtml(input.caseId);
  const clinicName = escapeHtml(safe(input.clinicName) || "—");
  const doctorName = escapeHtml(safe(input.doctorName) || "—");
  const contributionUrl = input.contributionUrl.replace(/"/g, "&quot;");

  const isReminder = variant === "reminder";
  const isFinal = variant === "final";

  const openingBlurb = isFinal
    ? "This is a final courtesy reminder: one of your patients has submitted their hair transplant results to HairAudit for independent review. Your contribution window is still open."
    : isReminder
      ? "This is a reminder: one of your patients has submitted their hair transplant results to HairAudit for independent review. We invite you to contribute procedural data so the audit reflects full clinical context."
      : "One of your patients has recently submitted their hair transplant results to HairAudit for independent review. We assess each case with clinical accuracy and full context — not only patient-provided images. Your clinic can contribute procedural data so the audit reflects the complete picture.";

  const ctaLabel = "Submit Case Information";
  const urgencyLine =
    variant === "final"
      ? "This is your last opportunity to contribute before the window closes."
      : "We recommend responding within 48 hours so the audit can include your input.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HairAudit — Case contribution request</title>
  <style>@media only screen and (max-width: 620px) { .container { width: 100% !important; max-width: 100% !important; } .mobile-full { width: 100% !important; max-width: 100% !important; display: block !important; } .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; } .cta-cell { width: 100% !important; } .cta-link { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; } }</style>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.55; color: ${CHARCOAL}; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 32px 16px;">
        <table role="presentation" class="container" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td class="mobile-pad" style="padding: 28px 28px 24px 28px; border-bottom: 1px solid ${BORDER};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: left;">
                    <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: ${CHARCOAL}; letter-spacing: -0.02em;">HairAudit</p>
                    <p style="margin: 0; font-size: 12px; font-weight: 500; color: ${GOLD}; text-transform: uppercase; letter-spacing: 0.04em;">Independent Surgical Review</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Opening -->
          <tr>
            <td class="mobile-pad" style="padding: 28px 28px 0 28px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: ${CHARCOAL_MUTED}; line-height: 1.6;">${openingBlurb}</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: ${CHARCOAL_MUTED}; line-height: 1.6;">Contributing procedural documentation helps ensure an accurate, fair representation of the work and supports audit confidence and transparency for all parties.</p>
            </td>
          </tr>
          <!-- Divider -->
          <tr><td class="mobile-pad" style="padding: 0 28px;"><div style="height: 1px; background-color: ${BORDER}; margin: 0 0 24px 0;"></div></td></tr>
          <!-- Benefits panel -->
          <tr>
            <td class="mobile-pad" style="padding: 0 28px 24px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${PANEL_BG}; border-radius: 8px; border-left: 4px solid ${GOLD}; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <tr>
                  <td style="padding: 22px 24px;">
                    <p style="margin: 0 0 14px 0; font-size: 15px; font-weight: 700; color: ${CHARCOAL}; line-height: 1.35;">Benefits of contributing</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: ${CHARCOAL_MUTED}; line-height: 1.5;"><span style="color: ${GOLD}; font-weight: 700;">•</span> Accurate representation of the surgical work in the audit</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: ${CHARCOAL_MUTED}; line-height: 1.5;"><span style="color: ${GOLD}; font-weight: 700;">•</span> Improved audit confidence and completeness</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: ${CHARCOAL_MUTED}; line-height: 1.5;"><span style="color: ${GOLD}; font-weight: 700;">•</span> Protection of your clinic’s reputation through full context</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: ${CHARCOAL_MUTED}; line-height: 1.5;"><span style="color: ${GOLD}; font-weight: 700;">•</span> Inclusion of clinical context so outcomes are assessed fairly</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Platform positioning -->
          <tr>
            <td class="mobile-pad" style="padding: 0 28px 20px 28px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: ${CHARCOAL}; line-height: 1.35;">About HairAudit</p>
              <p style="margin: 0; font-size: 14px; color: ${CHARCOAL_MUTED}; line-height: 1.55;">HairAudit is a global benchmark for hair transplant outcomes, with clinic profiles and ratings. Clinics also use it as an internal audit tool to track and improve results.</p>
            </td>
          </tr>
          <!-- Divider -->
          <tr><td class="mobile-pad" style="padding: 0 28px;"><div style="height: 1px; background-color: ${BORDER}; margin: 0 0 24px 0;"></div></td></tr>
          <!-- Case details box -->
          <tr>
            <td class="mobile-pad" style="padding: 0 28px 24px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${CASE_BOX_BG}; border-radius: 8px; border: 1px solid ${BORDER};">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 14px 0; font-size: 13px; font-weight: 700; color: ${CHARCOAL}; text-transform: uppercase; letter-spacing: 0.03em;">Case details</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr><td style="padding: 5px 0 0 0; font-size: 12px; font-weight: 600; color: #6b7280;">Case ID</td></tr><tr><td style="padding: 2px 0 10px 0; font-size: 15px; color: ${CHARCOAL}; font-weight: 500;">${caseId}</td></tr>
                      <tr><td style="padding: 5px 0 0 0; font-size: 12px; font-weight: 600; color: #6b7280;">Clinic</td></tr><tr><td style="padding: 2px 0 10px 0; font-size: 15px; color: ${CHARCOAL};">${clinicName}</td></tr>
                      <tr><td style="padding: 5px 0 0 0; font-size: 12px; font-weight: 600; color: #6b7280;">Doctor</td></tr><tr><td style="padding: 2px 0 0 0; font-size: 15px; color: ${CHARCOAL};">${doctorName}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td class="mobile-pad" style="padding: 0 28px 28px 28px; text-align: center;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: ${CHARCOAL_MUTED}; line-height: 1.5;">${urgencyLine}</p>
              <table role="presentation" align="center" cellspacing="0" cellpadding="0" class="mobile-full" style="margin: 0 auto; max-width: 320px;">
                <tr>
                  <td class="cta-cell" style="border-radius: 8px; background-color: ${GOLD}; box-shadow: 0 2px 10px rgba(184, 134, 11, 0.35);">
                    <a href="${contributionUrl}" target="_blank" rel="noopener noreferrer" class="cta-link" style="display: inline-block; padding: 16px 36px; font-size: 17px; font-weight: 600; color: ${CHARCOAL}; text-decoration: none;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 14px 0 0 0; font-size: 12px; color: #9ca3af;">This link is for authorized clinic or surgeon use only.</p>
            </td>
          </tr>
          <!-- Divider -->
          <tr><td class="mobile-pad" style="padding: 0 28px;"><div style="height: 1px; background-color: ${BORDER};"></div></td></tr>
          <!-- Closing -->
          <tr>
            <td class="mobile-pad" style="padding: 24px 28px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: ${CHARCOAL_MUTED}; line-height: 1.55;">HairAudit is committed to fairness and transparency. Your contribution ensures the audit reflects the full clinical context.</p>
              <p style="margin: 0; font-size: 13px; color: #6b7280;">You can also explore your clinic profile and past audits on the platform.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="mobile-pad" style="padding: 20px 28px 28px 28px; border-top: 1px solid ${BORDER};">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">HairAudit — Independent surgical review and global benchmarking</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 48-hour follow-up: shorter, more direct, with stronger urgency.
 * Used when clinic has not responded to the initial request.
 */
function buildReminderFollowUpHtml(input: ContributionEmailCommon): string {
  const caseId = escapeHtml(input.caseId);
  const clinicName = escapeHtml(safe(input.clinicName) || "—");
  const doctorName = escapeHtml(safe(input.doctorName) || "—");
  const contributionUrl = input.contributionUrl.replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HairAudit — Contribution reminder</title>
  <style>@media only screen and (max-width: 620px) { .container { width: 100% !important; max-width: 100% !important; } .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; } .cta-cell { width: 100% !important; } .cta-link { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; } }</style>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.55; color: ${CHARCOAL}; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 32px 16px;">
        <table role="presentation" class="container" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
          <tr>
            <td class="mobile-pad" style="padding: 24px 28px; border-bottom: 1px solid ${BORDER};">
              <p style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: ${CHARCOAL}; letter-spacing: -0.02em;">HairAudit</p>
              <p style="margin: 0; font-size: 11px; font-weight: 500; color: ${GOLD}; text-transform: uppercase; letter-spacing: 0.04em;">Independent Surgical Review</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-pad" style="padding: 24px 28px 0 28px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: ${CHARCOAL}; line-height: 1.4;">We have not yet received your contribution for this case.</p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: ${CHARCOAL_MUTED}; line-height: 1.6;">The audit may proceed on the basis of patient-submitted information alone if we do not hear from you. Contributing your procedural data ensures the review reflects full clinical context and supports an accurate, fair representation of your work — which matters for both audit quality and your clinic’s reputation.</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-pad" style="padding: 20px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${CASE_BOX_BG}; border-radius: 8px; border: 1px solid ${BORDER};">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #6b7280;">Case ID</p>
                    <p style="margin: 0 0 12px 0; font-size: 15px; color: ${CHARCOAL}; font-weight: 500;">${caseId}</p>
                    <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #6b7280;">Clinic · Doctor</p>
                    <p style="margin: 0; font-size: 14px; color: ${CHARCOAL};">${clinicName} · ${doctorName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="mobile-pad" style="padding: 0 28px 28px 28px; text-align: center;">
              <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin: 0 auto; max-width: 320px;">
                <tr>
                  <td class="cta-cell" style="border-radius: 8px; background-color: ${GOLD}; box-shadow: 0 2px 10px rgba(184, 134, 11, 0.35);">
                    <a href="${contributionUrl}" target="_blank" rel="noopener noreferrer" class="cta-link" style="display: inline-block; padding: 16px 36px; font-size: 17px; font-weight: 600; color: ${CHARCOAL}; text-decoration: none;">Submit Case Information</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af;">Authorized clinic or surgeon use only.</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-pad" style="padding: 20px 28px 28px 28px; border-top: 1px solid ${BORDER};">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">HairAudit — Independent surgical review and global benchmarking</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendInitialContributionRequestEmail(input: ContributionEmailCommon) {
  if (!input.to.length) return false;
  return sendEmail({
    to: input.to,
    subject: "Request for clinical documentation to support a fair forensic review",
    html: buildClinicOutreachHtml(input, "initial"),
  });
}

export async function sendReminderContributionEmail(input: ContributionEmailCommon) {
  if (!input.to.length) return false;
  return sendEmail({
    to: input.to,
    subject: "Your input still needed for this HairAudit case review",
    html: buildReminderFollowUpHtml(input),
  });
}

export async function sendFinalCourtesyContributionEmail(input: ContributionEmailCommon) {
  if (!input.to.length) return false;
  return sendEmail({
    to: input.to,
    subject: "Final invitation to contribute to this case review",
    html: buildClinicOutreachHtml(input, "final"),
  });
}
