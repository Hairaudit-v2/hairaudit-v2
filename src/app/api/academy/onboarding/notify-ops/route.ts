import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { buildRequestEmailToOps, academyOpsInboxAddress } from "@/lib/academy/onboardingTemplate";
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
    clinicOrOrganization?: string;
    requesterName?: string;
    requesterEmail?: string;
    rolesNeeded?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const clinicOrOrganization = String(body.clinicOrOrganization ?? "").trim();
  const requesterName = String(body.requesterName ?? "").trim();
  const requesterEmail = String(body.requesterEmail ?? "").trim();
  const rolesNeeded = String(body.rolesNeeded ?? "").trim();

  if (!clinicOrOrganization || !requesterName || !requesterEmail || !rolesNeeded) {
    return NextResponse.json(
      { ok: false, error: "clinicOrOrganization, requesterName, requesterEmail, and rolesNeeded are required" },
      { status: 400 }
    );
  }

  const { subject, body: textBody } = buildRequestEmailToOps({
    clinicOrOrganization,
    requesterName,
    requesterEmail,
    rolesNeeded,
    notes: body.notes ? String(body.notes) : undefined,
  });

  const html = `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${textBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</pre>`;

  const ccRequester =
    process.env.ACADEMY_ONBOARDING_CC_REQUESTER === "1" ||
    process.env.ACADEMY_ONBOARDING_CC_REQUESTER === "true";

  const delivered = await sendEmail({
    to: ccRequester ? [to, requesterEmail] : to,
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
