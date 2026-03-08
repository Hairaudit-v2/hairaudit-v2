import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { generateContributionToken, hashContributionToken } from "@/lib/transparency/contributionTokens";
import { sendInitialContributionRequestEmail } from "@/lib/transparency/emails";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function validEmail(v: string) {
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  try {
    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const caseId = clean(body?.caseId);
    const clinicName = clean(body?.clinicName);
    const doctorName = clean(body?.doctorName);
    const clinicEmail = clean(body?.clinicEmail).toLowerCase();
    const doctorEmail = clean(body?.doctorEmail).toLowerCase();
    const patientConsent = Boolean(body?.patientConsent);

    if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    if (!patientConsent) {
      return NextResponse.json({ error: "Patient consent is required before sending a request." }, { status: 400 });
    }
    if (!clinicEmail && !doctorEmail) {
      return NextResponse.json({ error: "At least one email is required." }, { status: 400 });
    }
    if (clinicEmail && !validEmail(clinicEmail)) {
      return NextResponse.json({ error: "Clinic email is invalid." }, { status: 400 });
    }
    if (doctorEmail && !validEmail(doctorEmail)) {
      return NextResponse.json({ error: "Doctor email is invalid." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: caseRow } = await admin
      .from("cases")
      .select("id, user_id, patient_id")
      .eq("id", caseId)
      .maybeSingle();
    if (!caseRow || (caseRow.user_id !== user.id && caseRow.patient_id !== user.id)) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    let clinicProfileId: string | null = null;
    let doctorProfileId: string | null = null;

    if (clinicName || clinicEmail) {
      const { data: existingClinic } = await admin
        .from("clinic_profiles")
        .select("id")
        .eq("clinic_name", clinicName || "Unspecified Clinic")
        .eq("clinic_email", clinicEmail || null)
        .maybeSingle();
      if (existingClinic?.id) {
        clinicProfileId = existingClinic.id;
      } else {
        const { data: createdClinic } = await admin
          .from("clinic_profiles")
          .insert({
            clinic_name: clinicName || "Unspecified Clinic",
            clinic_email: clinicEmail || null,
            participation_status: "invited",
          })
          .select("id")
          .maybeSingle();
        clinicProfileId = createdClinic?.id ?? null;
      }
    }

    if (doctorName || doctorEmail) {
      const { data: existingDoctor } = await admin
        .from("doctor_profiles")
        .select("id")
        .eq("doctor_name", doctorName || "Unspecified Doctor")
        .eq("doctor_email", doctorEmail || null)
        .maybeSingle();
      if (existingDoctor?.id) {
        doctorProfileId = existingDoctor.id;
      } else {
        const { data: createdDoctor } = await admin
          .from("doctor_profiles")
          .insert({
            doctor_name: doctorName || "Unspecified Doctor",
            doctor_email: doctorEmail || null,
            clinic_profile_id: clinicProfileId,
            participation_status: "invited",
          })
          .select("id")
          .maybeSingle();
        doctorProfileId = createdDoctor?.id ?? null;
      }
    }

    const token = generateContributionToken();
    const tokenHash = hashContributionToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

    const snapshot = {
      clinicName,
      doctorName,
      clinicEmail,
      doctorEmail,
      patientConsent,
      submittedByUserId: user.id,
      submittedAt: new Date().toISOString(),
    };

    const recipientEmails = [clinicEmail, doctorEmail].filter(Boolean);
    const { data: requestRow, error: reqErr } = await admin
      .from("case_contribution_requests")
      .insert({
        case_id: caseId,
        requested_by_user_id: user.id,
        clinic_profile_id: clinicProfileId,
        doctor_profile_id: doctorProfileId,
        status: "clinic_request_pending",
        patient_consent: true,
        secure_token_hash: tokenHash,
        secure_token_expires_at: expiresAt,
        clinic_name_snapshot: clinicName || null,
        doctor_name_snapshot: doctorName || null,
        clinic_email_snapshot: clinicEmail || null,
        doctor_email_snapshot: doctorEmail || null,
        recipient_emails: recipientEmails,
        request_snapshot: snapshot,
      })
      .select("id, created_at, status")
      .maybeSingle();

    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hairaudit.com";
    const contributionUrl = `${baseUrl}/contribute/${token}`;
    await admin
      .from("case_contribution_requests")
      .update({
        secure_contribution_path: contributionUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestRow?.id ?? "");
    const emailSent = await sendInitialContributionRequestEmail({
      to: recipientEmails,
      caseId,
      contributionUrl,
      clinicName: clinicName || null,
      doctorName: doctorName || null,
    });

    let currentStatus = "clinic_request_pending";
    if (emailSent) {
      await admin
        .from("case_contribution_requests")
        .update({
          status: "clinic_request_sent",
          last_email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestRow?.id ?? "");
      await admin.from("cases").update({ status: "clinic_request_sent" }).eq("id", caseId);
      currentStatus = "clinic_request_sent";
    } else {
      await admin.from("cases").update({ status: "clinic_request_pending" }).eq("id", caseId);
    }

    if (requestRow?.id) {
      try {
        await inngest.send({
          name: "contribution-request/created",
          data: {
            requestId: requestRow.id,
            caseId,
            clinicProfileId,
            doctorProfileId,
            clinicEmail: clinicEmail || null,
            doctorEmail: doctorEmail || null,
            currentStatus,
            createdAt: requestRow.created_at ?? new Date().toISOString(),
          },
        });
      } catch (eventErr) {
        console.error("contribution-request/created emit failed", { requestId: requestRow.id, error: eventErr });
      }
    }

    return NextResponse.json({ ok: true, requestId: requestRow?.id ?? null });
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? "Server error";
    console.error("case-contribution-requests POST:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
