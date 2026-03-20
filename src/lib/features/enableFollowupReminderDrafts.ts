/**
 * Clinic case view: copy-ready follow-up reminder drafts (Stage 10A).
 * No automatic sending. Enable with NEXT_PUBLIC_ENABLE_CLINIC_FOLLOWUP_REMINDER_DRAFTS=true
 */

export const ENABLE_CLINIC_FOLLOWUP_REMINDER_DRAFTS = "NEXT_PUBLIC_ENABLE_CLINIC_FOLLOWUP_REMINDER_DRAFTS";

export function isClinicFollowupReminderDraftsEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_CLINIC_FOLLOWUP_REMINDER_DRAFTS] ?? "").toLowerCase() === "true";
}
