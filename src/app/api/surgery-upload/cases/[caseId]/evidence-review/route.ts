// PATCH /api/surgery-upload/cases/[caseId]/evidence-review — auditor sets the
// overall evidence review status + notes for a SUBMITTED mobile surgery upload.
// Reviewer-only. Does NOT trigger the AI/audit pipeline and does NOT change
// cases.status or surgery_upload_details.status.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import {
  canEditEvidenceReview,
  isEvidenceReviewStatus,
  type EvidenceReviewStatus,
} from "@/lib/surgeryUpload/evidenceReview";
import { logEvidenceEvent } from "@/lib/surgeryUpload/logEvidenceEvent";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/evidence-review]";
const MAX_TEXT = 4000;

function trimText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t.slice(0, MAX_TEXT);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
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
    // Reviewer decisions are auditor-only.
    if (!canEditEvidenceReview(actor)) {
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

    const { data: existing } = await admin
      .from("surgery_upload_details")
      .select("id, status, evidence_review_status, evidence_request_message")
      .eq("case_id", caseId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Surgery upload not found for this case" },
        { status: 404 }
      );
    }
    // Only submitted uploads enter the review workflow.
    if (existing.status !== "submitted") {
      return NextResponse.json(
        { ok: false, error: "Only submitted surgery uploads can be reviewed." },
        { status: 409 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const status = body.evidenceReviewStatus;
    if (!isEvidenceReviewStatus(status) || status === "not_reviewed") {
      return NextResponse.json({ ok: false, error: "Invalid evidenceReviewStatus" }, { status: 400 });
    }
    const reviewStatus = status as EvidenceReviewStatus;
    const notes = trimText(body.evidenceReviewNotes);
    const requestMessage = trimText(body.evidenceRequestMessage);

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      evidence_review_status: reviewStatus,
    };
    if ("evidenceReviewNotes" in body) update.evidence_review_notes = notes;

    // Status-specific stamps. We intentionally preserve evidence_request_message
    // for history unless a new one is supplied with a needs_more_evidence action.
    if (reviewStatus === "needs_more_evidence") {
      update.evidence_requested_at = now;
      update.evidence_requested_by = user.id;
      if (requestMessage !== null) update.evidence_request_message = requestMessage;
    } else if (reviewStatus === "evidence_accepted" || reviewStatus === "in_review") {
      update.evidence_reviewed_at = now;
      update.evidence_reviewed_by = user.id;
    } else if (reviewStatus === "ready_for_audit") {
      update.evidence_reviewed_at = now;
      update.evidence_reviewed_by = user.id;
      update.ready_for_audit_at = now;
      update.ready_for_audit_by = user.id;
    }

    const { data: updated, error: updErr } = await admin
      .from("surgery_upload_details")
      .update(update)
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
      eventType: "evidence_review_status_changed",
      metadata: {
        from: existing.evidence_review_status ?? "not_reviewed",
        to: reviewStatus,
        hasNotes: notes !== null,
        hasRequestMessage: requestMessage !== null,
        // Stage 6A: persist the actual text (already shown to the clinic/doctor) so
        // the read-only evidence timeline can surface it. Additive + backward compatible.
        ...(reviewStatus === "needs_more_evidence" && requestMessage !== null
          ? { requestMessage }
          : {}),
        ...(notes !== null ? { reviewerNotes: notes } : {}),
      },
    });

    return NextResponse.json({ ok: true, details: updated });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json({ ok: false, error: "Could not save review" }, { status: 500 });
  }
}
