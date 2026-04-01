/**
 * Copy-paste templates for clinic ↔ Evolved (IIOHR) academy access coordination.
 * Inbox address: set ACADEMY_OPS_NOTIFICATION_EMAIL in env (e.g. academy@evolved.com).
 */

export function academyOpsInboxAddress(): string {
  return (process.env.ACADEMY_OPS_NOTIFICATION_EMAIL ?? "").trim();
}

export function buildRequestEmailToOps(params: {
  clinicOrOrganization: string;
  requesterName: string;
  requesterEmail: string;
  rolesNeeded: string;
  notes?: string;
}): { subject: string; body: string } {
  const subject = `[IIOHR Academy] Access list — ${params.clinicOrOrganization}`;
  const body = `Hello Evolved / IIOHR Academy team,

Please register the following people for HairAudit IIOHR Academy access.

Organization / clinic: ${params.clinicOrOrganization}
Requested by: ${params.requesterName} <${params.requesterEmail}>

Roles and work emails (one per line: role, email, display name optional):
${params.rolesNeeded}

${params.notes?.trim() ? `Notes:\n${params.notes.trim()}\n\n` : ""}After you confirm, we will send each person a login link from HairAudit.

Thank you,
${params.requesterName}`;

  return { subject, body };
}

export function buildMailtoOpsHref(params: Parameters<typeof buildRequestEmailToOps>[0]): string {
  const { subject, body } = buildRequestEmailToOps(params);
  const inbox = academyOpsInboxAddress();
  if (!inbox) return "";
  return `mailto:${encodeURIComponent(inbox)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
