/**
 * Clinic case view: gentle follow-up reminder readiness from timeline + optional intake dates.
 * No outbound messaging. Rollback: unset or NEXT_PUBLIC_ENABLE_CLINIC_FOLLOWUP_REMINDER_READINESS=false
 */

export const ENABLE_CLINIC_FOLLOWUP_REMINDER_READINESS = "NEXT_PUBLIC_ENABLE_CLINIC_FOLLOWUP_REMINDER_READINESS";

export function isClinicFollowupReminderReadinessEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_CLINIC_FOLLOWUP_REMINDER_READINESS] ?? "").toLowerCase() === "true";
}
