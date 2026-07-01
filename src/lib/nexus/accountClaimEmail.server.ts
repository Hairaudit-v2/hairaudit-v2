import { SITE_URL } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { maskEmailForClaimPreview } from "@/lib/nexus/accountClaimToken.server";

export type NexusAccountClaimEmailInput = {
  to: string;
  claimToken: string;
  expiresAt: string;
  professionalRole?: string;
};

function formatExpiryDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function buildNexusAccountClaimEmailContent(input: NexusAccountClaimEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const claimUrl = `${SITE_URL}/signup?claimToken=${encodeURIComponent(input.claimToken)}`;
  const expiryText = formatExpiryDate(input.expiresAt);
  const roleLabel = input.professionalRole?.trim() || "network professional";

  const subject = "Activate your HairAudit professional account";
  const text = [
    "You have been invited to activate your HairAudit professional account.",
    "",
    `Role: ${roleLabel}`,
    `This invite is intended for: ${maskEmailForClaimPreview(input.to)}`,
    "",
    `Activate your account: ${claimUrl}`,
    "",
    `This link expires on ${expiryText} (UTC) and can only be used once.`,
    "",
    "If you did not expect this invitation, you can ignore this email.",
    "",
    "HairAudit — independent clinical review",
  ].join("\n");

  const html = `
    <p>You have been invited to activate your HairAudit professional account.</p>
    <p><strong>Role:</strong> ${roleLabel}</p>
    <p><strong>Intended recipient:</strong> ${maskEmailForClaimPreview(input.to)}</p>
    <p><a href="${claimUrl}">Activate your account</a></p>
    <p>This link expires on <strong>${expiryText} (UTC)</strong> and can only be used once.</p>
    <p>If you did not expect this invitation, you can ignore this email.</p>
    <p>HairAudit — independent clinical review</p>
  `.trim();

  return { subject, html, text };
}

export async function sendNexusAccountClaimInviteEmail(
  input: NexusAccountClaimEmailInput
): Promise<boolean> {
  const { subject, html, text } = buildNexusAccountClaimEmailContent(input);
  return sendEmail({ to: input.to, subject, html, text });
}

export type NexusClinicAccountClaimEmailInput = {
  to: string;
  claimToken: string;
  expiresAt: string;
  clinicName?: string;
};

export function buildNexusClinicAccountClaimEmailContent(input: NexusClinicAccountClaimEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const claimUrl = `${SITE_URL}/signup?claimToken=${encodeURIComponent(input.claimToken)}`;
  const expiryText = formatExpiryDate(input.expiresAt);
  const clinicLabel = input.clinicName?.trim() || "your clinic";

  const subject = "Activate your HairAudit clinic account";
  const text = [
    "You have been invited to activate your HairAudit clinic account.",
    "",
    `Clinic: ${clinicLabel}`,
    `This invite is intended for: ${maskEmailForClaimPreview(input.to)}`,
    "",
    `Activate your clinic account: ${claimUrl}`,
    "",
    `This link expires on ${expiryText} (UTC) and can only be used once.`,
    "",
    "If you did not expect this invitation, you can ignore this email.",
    "",
    "HairAudit — independent clinical review",
  ].join("\n");

  const html = `
    <p>You have been invited to activate your HairAudit clinic account.</p>
    <p><strong>Clinic:</strong> ${clinicLabel}</p>
    <p><strong>Intended recipient:</strong> ${maskEmailForClaimPreview(input.to)}</p>
    <p><a href="${claimUrl}">Activate your clinic account</a></p>
    <p>This link expires on <strong>${expiryText} (UTC)</strong> and can only be used once.</p>
    <p>If you did not expect this invitation, you can ignore this email.</p>
    <p>HairAudit — independent clinical review</p>
  `.trim();

  return { subject, html, text };
}

export async function sendNexusClinicAccountClaimInviteEmail(
  input: NexusClinicAccountClaimEmailInput
): Promise<boolean> {
  const { subject, html, text } = buildNexusClinicAccountClaimEmailContent(input);
  return sendEmail({ to: input.to, subject, html, text });
}
