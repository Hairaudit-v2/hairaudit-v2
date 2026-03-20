/**
 * Clinic case view: manual send of follow-up reminder drafts (Stage 10B).
 * No scheduling or auto-send. Enable with NEXT_PUBLIC_ENABLE_CLINIC_FOLLOWUP_MANUAL_SEND=true
 */

export const ENABLE_CLINIC_FOLLOWUP_MANUAL_SEND = "NEXT_PUBLIC_ENABLE_CLINIC_FOLLOWUP_MANUAL_SEND";

export function isClinicFollowupManualSendEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_CLINIC_FOLLOWUP_MANUAL_SEND] ?? "").toLowerCase() === "true";
}
