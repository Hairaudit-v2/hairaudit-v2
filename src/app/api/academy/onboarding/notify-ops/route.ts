import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { buildTrainingAcademyRosterRequestEmail, academyOpsInboxAddress } from "@/lib/academy/onboardingTemplate";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const to = academyOpsInboxAddress();
  if (!to) {
    return NextResponse.json(
      {
        ok: false,
        error: "ACADEMY_OPS_NOTIFICATION_EMAIL is not configured on the server.",
      },
      { status: 503 }
    );
  }

  let body: {
    trainingSiteOrProgram?: string;
    hairauditAdminName?: string;
    hairauditAdminEmail?: string;
    notesForAcademy?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const trainingSiteOrProgram = String(body.trainingSiteOrProgram ?? "").trim();
  const hairauditAdminName = String(body.hairauditAdminName ?? "").trim();
  const hairauditAdminEmail = String(body.hairauditAdminEmail ?? "").trim();

  if (!trainingSiteOrProgram || !hairauditAdminName || !hairauditAdminEmail) {
    return NextResponse.json(
      {
        ok: false,
        error: "trainingSiteOrProgram, hairauditAdminName, and hairauditAdminEmail are required",
      },
      { status: 400 }
    );
  }

  const { subject, body: textBody } = buildTrainingAcademyRosterRequestEmail({
    trainingSiteOrProgram,
    hairauditAdminName,
    hairauditAdminEmail,
    notesForAcademy: body.notesForAcademy ? String(body.notesForAcademy) : undefined,
  });

  const html = `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${textBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</pre>`;

  const ccHairAuditAdmin =
    process.env.ACADEMY_ONBOARDING_CC_REQUESTER === "1" ||
    process.env.ACADEMY_ONBOARDING_CC_REQUESTER === "true";

  const delivered = await sendEmail({
    to: ccHairAuditAdmin ? [to, hairauditAdminEmail] : to,
    subject,
    html,
    text: textBody,
  });

  if (!delivered) {
    return NextResponse.json(
      {
        ok: false,
        error: "Email could not be sent (check RESEND_API_KEY and NOTIFICATION_FROM_EMAIL).",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
