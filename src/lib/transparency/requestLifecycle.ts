import type { SupabaseClient } from "@supabase/supabase-js";

export const CONTRIBUTION_REMINDER_TIMING = {
  firstReminderDelay: "5d",
  secondReminderDelay: "7d",
} as const;

export const CONTRIBUTION_STOP_STATUSES = new Set([
  "doctor_contribution_received",
  "benchmark_recalculated",
  "benchmark_eligible",
  "request_closed",
  "request_expired",
]);

const CONTRIBUTION_REMINDER_ELIGIBLE_STATUSES = new Set([
  "clinic_request_pending",
  "clinic_request_sent",
  "clinic_viewed_request",
]);

export type ReminderType = "reminder_1" | "reminder_2";

export type ContributionRequestRow = {
  id: string;
  case_id: string;
  clinic_profile_id: string | null;
  doctor_profile_id: string | null;
  status: string | null;
  recipient_emails: unknown;
  clinic_email_snapshot: string | null;
  doctor_email_snapshot: string | null;
  clinic_name_snapshot: string | null;
  doctor_name_snapshot: string | null;
  reminder_count: number | null;
  reminder_1_sent_at: string | null;
  reminder_2_sent_at: string | null;
  secure_token_expires_at: string | null;
  secure_contribution_path: string | null;
};

export function reminderLinkForRequest(request: ContributionRequestRow): string | null {
  return request.secure_contribution_path ? String(request.secure_contribution_path) : null;
}

export async function getContributionRequestById(supabase: SupabaseClient, requestId: string): Promise<ContributionRequestRow | null> {
  const { data } = await supabase
    .from("case_contribution_requests")
    .select(
      "id, case_id, clinic_profile_id, doctor_profile_id, status, recipient_emails, clinic_email_snapshot, doctor_email_snapshot, clinic_name_snapshot, doctor_name_snapshot, reminder_count, reminder_1_sent_at, reminder_2_sent_at, secure_token_expires_at, secure_contribution_path"
    )
    .eq("id", requestId)
    .maybeSingle();
  return (data ?? null) as ContributionRequestRow | null;
}

export function isRequestTerminalStatus(status: string | null | undefined) {
  return CONTRIBUTION_STOP_STATUSES.has(String(status ?? ""));
}

export function isRequestExpired(request: ContributionRequestRow) {
  if (!request.secure_token_expires_at) return false;
  return new Date(request.secure_token_expires_at).getTime() < Date.now();
}

export function shouldSendReminder(request: ContributionRequestRow, reminderType: ReminderType) {
  if (isRequestTerminalStatus(request.status)) return false;
  if (!CONTRIBUTION_REMINDER_ELIGIBLE_STATUSES.has(String(request.status ?? ""))) return false;
  if (isRequestExpired(request)) return false;
  if (!reminderLinkForRequest(request)) return false;
  if (reminderType === "reminder_1" && request.reminder_1_sent_at) return false;
  if (reminderType === "reminder_2" && request.reminder_2_sent_at) return false;
  return true;
}

export function requestRecipients(request: ContributionRequestRow): string[] {
  if (Array.isArray(request.recipient_emails)) {
    return request.recipient_emails.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  const fallback = [request.clinic_email_snapshot, request.doctor_email_snapshot]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(fallback));
}

export async function markReminderSent(
  supabase: SupabaseClient,
  requestId: string,
  reminderType: ReminderType,
  priorReminderCount: number | null
) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    last_email_sent_at: now,
    reminder_count: Number(priorReminderCount ?? 0) + 1,
    updated_at: now,
  };
  if (reminderType === "reminder_1") payload.reminder_1_sent_at = now;
  if (reminderType === "reminder_2") payload.reminder_2_sent_at = now;

  await supabase.from("case_contribution_requests").update(payload).eq("id", requestId);
}

export async function markRequestViewed(supabase: SupabaseClient, requestId: string) {
  const now = new Date().toISOString();
  await supabase
    .from("case_contribution_requests")
    .update({
      status: "clinic_viewed_request",
      viewed_at: now,
      last_opened_at: now,
      updated_at: now,
    })
    .eq("id", requestId);
}

export async function markContributionReceived(supabase: SupabaseClient, requestId: string) {
  const now = new Date().toISOString();
  await supabase
    .from("case_contribution_requests")
    .update({
      status: "doctor_contribution_received",
      contribution_received_at: now,
      updated_at: now,
    })
    .eq("id", requestId);
}

export async function markRequestClosed(supabase: SupabaseClient, requestId: string) {
  await supabase
    .from("case_contribution_requests")
    .update({
      status: "request_closed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
}

export async function markRequestExpired(supabase: SupabaseClient, requestId: string) {
  await supabase
    .from("case_contribution_requests")
    .update({
      status: "request_expired",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
}
