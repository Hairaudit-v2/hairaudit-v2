/**
 * POST /api/patient/cases/[caseId]/photo-sessions
 * Create or select a patient-confirmed photo session for guided upload.
 */

import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PHOTO_SESSION_MILESTONES, type PhotoSessionMilestone } from "@/lib/photoSessions/types";
import { createOrSelectPhotoSession } from "@/lib/photoSessions/attachUploadToPhotoSession";
import { normalizedPatientAnswersFromReportRow } from "@/lib/patient/answersFromReportRow";
import { readProcedureDateFromPatientAnswers } from "@/lib/patientPhoto/patientPhotoReadinessPolicy";

function isMilestone(v: unknown): v is PhotoSessionMilestone {
  return typeof v === "string" && (PHOTO_SESSION_MILESTONES as readonly string[]).includes(v);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      milestone?: unknown;
      patientConfirmed?: boolean;
    };

    if (!isMilestone(body.milestone) || body.milestone === "unknown") {
      return NextResponse.json({ ok: false, error: "Invalid milestone" }, { status: 400 });
    }

    const supabase = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: caseRow, error: caseErr } = await admin
      .from("cases")
      .select("id, user_id, patient_id, patient_review_pathway")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    }

    const allowed =
      caseRow.user_id === user.id ||
      caseRow.patient_id === user.id;
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: reportRow } = await admin
      .from("reports")
      .select("summary, patient_audit_version, patient_audit_v2")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const answers = normalizedPatientAnswersFromReportRow(reportRow);
    const procedureDate = readProcedureDateFromPatientAnswers(answers);

    const result = await createOrSelectPhotoSession({
      caseId,
      milestone: body.milestone,
      procedureDate,
      source: "patient_upload",
      milestoneSource: "patient",
      patientConfirmed: body.patientConfirmed !== false,
    });

    return NextResponse.json({
      ok: true,
      sessionId: result.id,
      created: result.created,
      milestone: body.milestone,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
