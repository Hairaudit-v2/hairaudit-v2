import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/case-access";
import { isClinicFollowupManualSendEnabled } from "@/lib/features/enableFollowupReminderManualSend";
import {
  clinicUserMaySendFollowupReminder,
  plainTextToSimpleEmailHtml,
  validateManualFollowupReminderSendBody,
} from "@/lib/audit/followupReminderSendPayload";
import { followupTimelineStageLabel } from "@/lib/audit/followupTimelineFromPatientUploads";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    if (!isClinicFollowupManualSendEnabled()) {
      return NextResponse.json({ error: "Feature disabled." }, { status: 404 });
    }

    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = await getUserRole(user.id);
    const parsed = await req.json().catch(() => null);
    const check = validateManualFollowupReminderSendBody(parsed);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    const v = check.value;

    const admin = tryCreateSupabaseAdminClient();
    const dbRead = admin ?? auth;
    const { data: caseRow, error: caseErr } = await dbRead
      .from("cases")
      .select("id, clinic_id")
      .eq("id", v.caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    if (!clinicUserMaySendFollowupReminder(caseRow.clinic_id as string | null, user.id, role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const subject =
      v.subject ??
      `HairAudit – optional ${followupTimelineStageLabel(v.milestoneId)} photos check-in`;
    const html = plainTextToSimpleEmailHtml(v.body);
    const text = v.body;

    const delivered = await sendEmail({
      to: v.recipient,
      subject,
      html,
      text,
    });

    const delivery_status = delivered ? "sent" : "failed";
    const error_message = delivered ? null : "Email could not be delivered. Check RESEND_API_KEY and NOTIFICATION_FROM_EMAIL.";

    const { data: inserted, error: insErr } = await auth
      .from("followup_reminder_send_log")
      .insert({
        case_id: v.caseId,
        milestone: v.milestoneId,
        channel: v.channel,
        recipient: v.recipient,
        subject,
        body: v.body,
        sent_by_user_id: user.id,
        source: "manual_draft_send",
        draft_schema_version: v.draftSchemaVersion,
        delivery_status,
        error_message,
      })
      .select(
        "id, case_id, milestone, channel, recipient, subject, body, sent_by_user_id, sent_at, source, draft_schema_version, delivery_status, error_message"
      )
      .single();

    if (insErr) {
      console.error("[followup-reminder-send] insert failed", insErr);
      return NextResponse.json(
        {
          error: delivered
            ? "Message may have been sent but logging failed. Contact support if you need the send record."
            : error_message,
          delivered,
        },
        { status: delivered ? 500 : 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      delivered,
      log: inserted,
    });
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? "Server error";
    console.error("followup-reminder-send POST:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
