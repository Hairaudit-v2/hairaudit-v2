import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { notifyPatientMoreInformationRequested } from "@/lib/email";
import {
  buildPatientInfoRequestEmailContent,
  isPatientInfoRequestType,
  patientSafeRequestReasonLabel,
  sanitizeAuditorNoteForPatient,
  type PatientInfoRequestType,
} from "@/lib/auditor/patientInfoRequest";

export const runtime = "nodejs";

type RequestBody = {
  caseId?: string;
  requestType?: string;
  auditorNote?: string;
};

async function resolveCasePatientContact(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  caseRow: { user_id?: string | null; patient_id?: string | null; patient_email?: string | null }
): Promise<{ email: string | null; firstName: string | null }> {
  const bulkEmail = String(caseRow.patient_email ?? "").trim();
  if (bulkEmail) return { email: bulkEmail, firstName: null };

  const userId = String(caseRow.patient_id ?? caseRow.user_id ?? "").trim();
  if (!userId) return { email: null, firstName: null };

  const { data: user, error } = await admin.auth.admin.getUserById(userId);
  if (error || !user?.user) return { email: null, firstName: null };

  const email = String(user.user.email ?? "").trim() || null;
  const meta = user.user.user_metadata as Record<string, unknown> | undefined;
  const firstNameRaw = meta?.first_name ?? meta?.name;
  const firstName = firstNameRaw != null ? String(firstNameRaw).trim() || null : null;
  return { email, firstName };
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    const caseId = String(body?.caseId ?? "").trim();
    const requestTypeRaw = String(body?.requestType ?? "").trim();
    const auditorNote = String(body?.auditorNote ?? "").trim();

    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    if (!isPatientInfoRequestType(requestTypeRaw)) {
      return NextResponse.json({ ok: false, error: "Invalid requestType" }, { status: 400 });
    }
    const requestType = requestTypeRaw as PatientInfoRequestType;

    const { data: foundCase, error: caseErr } = await admin
      .from("cases")
      .select("id, user_id, patient_id, patient_email, deleted_at")
      .eq("id", caseId)
      .maybeSingle();
    if (caseErr) return NextResponse.json({ ok: false, error: caseErr.message }, { status: 500 });
    if (!foundCase || foundCase.deleted_at) {
      return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    }

    const { email: patientEmail, firstName } = await resolveCasePatientContact(admin, foundCase);
    if (!patientEmail) {
      return NextResponse.json({ ok: false, error: "No patient email found for this case." }, { status: 409 });
    }

    const sanitizedNote = sanitizeAuditorNoteForPatient(auditorNote);
    const emailContent = buildPatientInfoRequestEmailContent({
      caseId,
      patientName: firstName,
      requestType,
      auditorNote: sanitizedNote,
    });

    const delivered = await notifyPatientMoreInformationRequested({
      to: patientEmail,
      caseId,
      firstName,
      requestType,
      auditorNote: sanitizedNote,
    });

    const now = new Date().toISOString();
    const deliveryStatus = delivered ? "sent" : "failed";
    const errorMessage = delivered
      ? null
      : "Email could not be delivered. Check RESEND_API_KEY and NOTIFICATION_FROM_EMAIL.";

    const { data: logRow, error: logErr } = await admin
      .from("patient_info_request_log")
      .insert({
        case_id: caseId,
        auditor_user_id: user.id,
        request_type: requestType,
        message_sent: emailContent.text,
        sent_at: now,
        delivery_status: deliveryStatus,
        error_message: errorMessage,
      })
      .select("id, case_id, auditor_user_id, request_type, message_sent, sent_at, delivery_status")
      .single();

    if (logErr) {
      console.error("[request-patient-information] audit log insert failed", logErr);
      return NextResponse.json(
        {
          ok: false,
          error: delivered
            ? "Message may have been sent but logging failed."
            : errorMessage,
          delivered,
        },
        { status: delivered ? 500 : 502 }
      );
    }

    const { data: latestReport, error: reportErr } = await admin
      .from("reports")
      .select("id, summary")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reportErr) {
      return NextResponse.json({ ok: false, error: reportErr.message }, { status: 500 });
    }

    if (latestReport) {
      const summary = (latestReport.summary ?? {}) as Record<string, unknown>;
      const auditorReview = (summary.auditor_review ?? {}) as Record<string, unknown>;
      const reasonLabel = patientSafeRequestReasonLabel(requestType);
      const nextSummary = {
        ...summary,
        auditor_review: {
          ...auditorReview,
          needs_more_evidence: true,
          needs_more_evidence_at: now,
          needs_more_evidence_by: user.id,
          needs_more_evidence_reason: reasonLabel,
          patient_info_request_type: requestType,
          patient_info_request_reason_label: reasonLabel,
          patient_info_request_sent_at: now,
          patient_info_request_note: sanitizedNote,
        },
      };

      const { error: updReportErr } = await admin
        .from("reports")
        .update({ summary: nextSummary, auditor_review_status: "in_review", updated_at: now })
        .eq("id", latestReport.id);
      if (updReportErr) {
        return NextResponse.json({ ok: false, error: updReportErr.message }, { status: 500 });
      }
    }

    const { error: updCaseErr } = await admin
      .from("cases")
      .update({
        status: "awaiting_patient_information",
        assigned_auditor_id: user.id,
        auditor_last_edited_at: now,
        updated_at: now,
      })
      .eq("id", caseId);
    if (updCaseErr) {
      return NextResponse.json({ ok: false, error: updCaseErr.message }, { status: 500 });
    }

    if (!delivered) {
      return NextResponse.json(
        { ok: false, error: errorMessage, delivered: false, log: logRow },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      delivered: true,
      log: logRow,
      requestType,
      reasonLabel: patientSafeRequestReasonLabel(requestType),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
