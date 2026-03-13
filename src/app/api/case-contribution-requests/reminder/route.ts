import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getUserRole } from "@/lib/case-access";
import {
  sendFinalCourtesyContributionEmail,
  sendReminderContributionEmail,
} from "@/lib/transparency/emails";

export async function POST(req: Request) {
  try {
    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = await getUserRole(user.id);
    if (role !== "auditor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId ?? "").trim();
    const reminderType = String(body?.reminderType ?? "reminder").trim(); // reminder | final
    const contributionUrl = String(body?.contributionUrl ?? "").trim();
    if (!requestId) return NextResponse.json({ error: "Missing requestId." }, { status: 400 });
    if (!contributionUrl) {
      return NextResponse.json({ error: "Missing contributionUrl." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: requestRow } = await admin
      .from("case_contribution_requests")
      .select(
        "id, case_id, recipient_emails, clinic_name_snapshot, doctor_name_snapshot, clinic_email_snapshot, doctor_email_snapshot, reminder_count"
      )
      .eq("id", requestId)
      .maybeSingle();
    if (!requestRow) return NextResponse.json({ error: "Request not found." }, { status: 404 });

    const recipients = Array.isArray(requestRow.recipient_emails)
      ? requestRow.recipient_emails.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    const fallbackRecipients = [requestRow.clinic_email_snapshot, requestRow.doctor_email_snapshot]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
    const finalRecipients = Array.from(new Set([...recipients, ...fallbackRecipients]));
    if (!finalRecipients.length) {
      return NextResponse.json(
        { error: "No recipient emails found for this contribution request." },
        { status: 400 }
      );
    }
    const sendResult =
      reminderType === "final"
        ? await sendFinalCourtesyContributionEmail({
            to: finalRecipients,
            caseId: requestRow.case_id,
            contributionUrl,
            clinicName: requestRow.clinic_name_snapshot,
            doctorName: requestRow.doctor_name_snapshot,
          })
        : await sendReminderContributionEmail({
            to: finalRecipients,
            caseId: requestRow.case_id,
            contributionUrl,
            clinicName: requestRow.clinic_name_snapshot,
            doctorName: requestRow.doctor_name_snapshot,
          });

    if (!sendResult) {
      return NextResponse.json(
        {
          error:
            "Reminder could not be delivered. Verify RESEND_API_KEY and NOTIFICATION_FROM_EMAIL, then retry.",
        },
        { status: 502 }
      );
    }

    await admin
      .from("case_contribution_requests")
      .update({
        ...(reminderType === "final"
          ? { reminder_2_sent_at: new Date().toISOString() }
          : { reminder_1_sent_at: new Date().toISOString() }),
        last_email_sent_at: new Date().toISOString(),
        reminder_count: Number(requestRow.reminder_count ?? 0) + 1,
        last_reminder_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? "Server error";
    console.error("case-contribution-requests/reminder POST:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
