// POST /api/surgery-upload/cases/[caseId]/resubmit-evidence — clinic/doctor (or
// auditor) signals that requested additional evidence has been added. Allowed ONLY
// when the upload is submitted and evidence_review_status = needs_more_evidence.
// Moves the review back to in_review for the auditor. Does NOT change
// surgery_upload_details.status and does NOT trigger the audit pipeline.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { canUploadAdditionalEvidence } from "@/lib/surgeryUpload/evidenceReview";
import { logEvidenceEvent } from "@/lib/surgeryUpload/logEvidenceEvent";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/resubmit-evidence]";

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
    if (!actor.allowed) {
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

    const { data: details } = await admin
      .from("surgery_upload_details")
      .select("id, status, evidence_review_status")
      .eq("case_id", caseId)
      .maybeSingle();
    if (!details) {
      return NextResponse.json(
        { ok: false, error: "Surgery upload not found for this case" },
        { status: 404 }
      );
    }
    // Only valid when a reviewer has actually requested more evidence.
    if (!canUploadAdditionalEvidence(details)) {
      return NextResponse.json(
        { ok: false, error: "No additional evidence has been requested for this upload." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updErr } = await admin
      .from("surgery_upload_details")
      .update({
        // Back to the reviewer queue; request message preserved for history.
        evidence_review_status: "in_review",
        evidence_resolved_at: now,
        evidence_resolved_by: user.id,
      })
      .eq("case_id", caseId)
      .select("*")
      .single();

    if (updErr) {
      console.error(LOG_PREFIX, "update failed", { caseId, error: updErr.message });
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    await logEvidenceEvent(admin, {
      caseId,
      actorId: user.id,
      eventType: "evidence_resubmitted",
    });

    return NextResponse.json({ ok: true, details: updated });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json({ ok: false, error: "Could not resubmit evidence" }, { status: 500 });
  }
}
