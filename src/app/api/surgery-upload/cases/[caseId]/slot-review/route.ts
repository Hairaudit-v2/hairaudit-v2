// PATCH /api/surgery-upload/cases/[caseId]/slot-review — auditor sets the review
// decision for ONE photo slot of a SUBMITTED mobile surgery upload. Reviewer-only.
// Upserts surgery_upload_slot_reviews(case_id, slot_key). Never touches photos.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { isValidSurgerySlot, normalizeSurgerySlot } from "@/lib/surgeryUpload/checklist";
import {
  canEditEvidenceReview,
  isSlotReviewStatus,
} from "@/lib/surgeryUpload/evidenceReview";
import { logEvidenceEvent } from "@/lib/surgeryUpload/logEvidenceEvent";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/slot-review]";
const MAX_NOTES = 4000;

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

    const { data: details } = await admin
      .from("surgery_upload_details")
      .select("id, status")
      .eq("case_id", caseId)
      .maybeSingle();
    if (!details) {
      return NextResponse.json(
        { ok: false, error: "Surgery upload not found for this case" },
        { status: 404 }
      );
    }
    if (details.status !== "submitted") {
      return NextResponse.json(
        { ok: false, error: "Only submitted surgery uploads can be reviewed." },
        { status: 409 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const slotRaw = body.slotKey;
    if (typeof slotRaw !== "string" || !isValidSurgerySlot(slotRaw)) {
      return NextResponse.json({ ok: false, error: "Invalid slotKey" }, { status: 400 });
    }
    const slotKey = normalizeSurgerySlot(slotRaw);

    const status = body.status;
    if (!isSlotReviewStatus(status)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const reviewerNotes =
      typeof body.reviewerNotes === "string" && body.reviewerNotes.trim() !== ""
        ? body.reviewerNotes.trim().slice(0, MAX_NOTES)
        : null;

    const now = new Date().toISOString();
    const { data: upserted, error: upErr } = await admin
      .from("surgery_upload_slot_reviews")
      .upsert(
        {
          case_id: caseId,
          slot_key: slotKey,
          status,
          reviewer_notes: reviewerNotes,
          reviewed_by: user.id,
          reviewed_at: now,
        },
        { onConflict: "case_id,slot_key" }
      )
      .select("case_id, slot_key, status, reviewer_notes, reviewed_by, reviewed_at")
      .single();

    if (upErr) {
      console.error(LOG_PREFIX, "upsert failed", { caseId, slotKey, error: upErr.message });
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    await logEvidenceEvent(admin, {
      caseId,
      actorId: user.id,
      eventType: "slot_review_updated",
      metadata: { slotKey, status },
    });

    return NextResponse.json({ ok: true, slotReview: upserted });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json({ ok: false, error: "Could not save slot review" }, { status: 500 });
  }
}
