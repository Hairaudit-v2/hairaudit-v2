// POST /api/admin/hair-audit/surgery-upload/[caseId]/request-report — Stage 7B
//
// Auditors request a non-AI "Evidence Review Report" PDF for a surgery-upload case.
//
// REGRESSION GUARDS (do not remove without product + security review):
// - MUST NOT call POST /api/submit or any submit handler.
// - MUST NOT set cases.status to submitted (or any pipeline-processing state).
// - MUST NOT set cases.submitted_at.
// - MUST NOT emit Inngest `case/submitted` (that fans out to runAudit / GII).
// - MUST NOT invoke the forensic AI audit or legacy PDF pipeline.
// - This route only updates surgery_upload_details pipeline columns, logs
//   surgery_upload_evidence_events, and emits `hairAudit/surgeryUploadReportRequested`.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { canTriggerAuditHandoff } from "@/lib/surgeryUpload/auditHandoff";
import { logEvidenceEvent } from "@/lib/surgeryUpload/logEvidenceEvent";
import { evaluateSurgeryEvidenceReportRequest } from "@/lib/surgeryUpload/surgeryEvidenceReportRequest";
import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_SURGERY_UPLOAD_EVIDENCE_REPORT_REQUESTED,
  type SurgeryUploadEvidenceReportRequestedData,
} from "@/lib/inngest/surgeryUploadReportEvents";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/admin/hair-audit/surgery-upload/request-report]";

export async function POST(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    if (!caseId) {
      return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    }

    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveSurgeryUploadActor(user);
    if (!canTriggerAuditHandoff(actor)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    const { data: c } = await admin
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id")
      .eq("id", caseId)
      .maybeSingle();
    if (!c || !(await canAccessCase(user.id, c))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: existing, error: exErr } = await admin
      .from("surgery_upload_details")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();

    if (exErr) {
      console.error(LOG_PREFIX, "details load error", exErr.message);
      return NextResponse.json({ ok: false, error: "Could not load surgery upload." }, { status: 500 });
    }

    const gate = evaluateSurgeryEvidenceReportRequest((existing as SurgeryUploadDetails | null) ?? null);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.reason }, { status: gate.status ?? 400 });
    }

    const now = new Date().toISOString();

    const { data: claimed, error: claimErr } = await admin
      .from("surgery_upload_details")
      .update({
        evidence_report_pipeline_status: "queued",
        evidence_report_requested_at: now,
        evidence_report_requested_by: user.id,
        evidence_report_failed_at: null,
        evidence_report_error: null,
      })
      .eq("case_id", caseId)
      .in("evidence_report_pipeline_status", ["not_started", "failed"])
      .select("*")
      .maybeSingle();

    if (claimErr) {
      console.error(LOG_PREFIX, "claim failed", claimErr.message);
      return NextResponse.json({ ok: false, error: "Could not queue report." }, { status: 500 });
    }

    if (!claimed) {
      return NextResponse.json(
        {
          ok: false,
          error: "A report is already queued, running, or completed. Refresh the page.",
        },
        { status: 409 }
      );
    }

    await logEvidenceEvent(admin, {
      caseId,
      actorId: user.id,
      eventType: "surgery-upload/report-requested",
      metadata: {
        requestedBy: user.id,
        requestedAt: now,
        source: "surgery-upload",
        reportType: "evidence-review",
      },
    });

    const payload: SurgeryUploadEvidenceReportRequestedData = {
      caseId,
      requestedBy: user.id,
      requestedAt: now,
    };

    try {
      await inngest.send({
        id: `surgery-upload-evidence-report:${caseId}:${crypto.randomUUID()}`,
        name: INNGEST_SURGERY_UPLOAD_EVIDENCE_REPORT_REQUESTED,
        data: payload,
      });
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.error(LOG_PREFIX, "inngest.send failed", { caseId, message: msg });
      await admin
        .from("surgery_upload_details")
        .update({
          evidence_report_pipeline_status: "failed",
          evidence_report_failed_at: new Date().toISOString(),
          evidence_report_error: "Could not queue background job (Inngest).",
        })
        .eq("case_id", caseId)
        .eq("evidence_report_pipeline_status", "queued");

      await logEvidenceEvent(admin, {
        caseId,
        actorId: user.id,
        eventType: "surgery-upload/report-failed",
        metadata: {
          source: "surgery-upload",
          reportType: "evidence-review",
          error: "enqueue_failed",
        },
      });

      return NextResponse.json(
        { ok: false, error: "Could not queue the report job. Check Inngest configuration." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      pipelineStatus: "queued",
      message:
        "Evidence review report requested. Generation runs in the background and does not submit this case for a forensic audit.",
      details: claimed,
    });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled", e);
    return NextResponse.json({ ok: false, error: "Unexpected error." }, { status: 500 });
  }
}
