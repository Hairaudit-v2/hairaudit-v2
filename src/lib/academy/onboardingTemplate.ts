/**
 * Email from HairAudit (academy admin) → training academy (e.g. IIOHR / Evolved).
 * Asks them to reply with the official roster so HairAudit can create logins.
 * Recipient: academy_sites.ops_notification_email when routed by site/program/trainee, else ACADEMY_OPS_NOTIFICATION_EMAIL.
 */

export function academyOpsInboxAddress(): string {
  return (process.env.ACADEMY_OPS_NOTIFICATION_EMAIL ?? "").trim();
}

export function buildTrainingAcademyRosterRequestEmail(params: {
  trainingSiteOrProgram: string;
  hairauditAdminName: string;
  hairauditAdminEmail: string;
  notesForAcademy?: string;
}): { subject: string; body: string } {
  const subject = `[HairAudit / IIOHR] Please send team roster — ${params.trainingSiteOrProgram}`;
  const body = `Hello IIOHR / Evolved training academy team,

HairAudit is ready to create IIOHR Academy workspace logins for your program. Please reply to this email with the completed roster (official work addresses only) so we can create accounts and send each person their login link.

Program / site / cohort: ${params.trainingSiteOrProgram}

From (HairAudit): ${params.hairauditAdminName} <${params.hairauditAdminEmail}>

Please reply with one line per person, in this format:
  role, email, display name (optional)

Valid roles:
  • trainer
  • clinic_staff
  • trainee

Example (for format only — please replace with your real team):
  trainer, lead.surgeon@clinic.com, Dr. A. Name
  clinic_staff, coordinator@clinic.com, Jane Coordinator
  trainee, fellow@clinic.com, Dr. B. Fellow

${params.notesForAcademy?.trim() ? `Notes from HairAudit:\n${params.notesForAcademy.trim()}\n\n` : ""}When your roster is ready, reply to ${params.hairauditAdminEmail}. We will create logins only after we receive the completed list from the training academy.

Thank you,
${params.hairauditAdminName}
— HairAudit · IIOHR Academy onboarding`;

  return { subject, body };
}

/** Server or any context where env is available */
export function buildMailtoTrainingAcademyHref(
  params: Parameters<typeof buildTrainingAcademyRosterRequestEmail>[0]
): string {
  return buildMailtoTrainingAcademyHrefForInbox(academyOpsInboxAddress(), params);
}

/** Client-safe: pass inbox from server-rendered props (non-public env is not in the browser bundle). */
export function buildMailtoTrainingAcademyHrefForInbox(
  trainingAcademyInbox: string,
  params: Parameters<typeof buildTrainingAcademyRosterRequestEmail>[0]
): string {
  const { subject, body } = buildTrainingAcademyRosterRequestEmail(params);
  const inbox = trainingAcademyInbox.trim();
  if (!inbox) return "";
  return `mailto:${encodeURIComponent(inbox)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
