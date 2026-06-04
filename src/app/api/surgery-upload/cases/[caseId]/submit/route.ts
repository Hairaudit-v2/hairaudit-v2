// POST /api/surgery-upload/cases/[caseId]/submit — submit a surgery upload for review
// Stage 1: marks surgery_upload_details.status = 'submitted' only. The case stays
// in 'draft' and the audit/AI pipeline is intentionally NOT triggered.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import {
  getMissingRequiredSurgerySlots,
  SURGERY_PHOTO_SLOTS,
  type SurgeryPhotoSlotKey,
} from "@/lib/surgeryUpload/checklist";

const SLOT_LABELS = new Map<SurgeryPhotoSlotKey, string>(
  SURGERY_PHOTO_SLOTS.map((s) => [s.key, s.label])
);

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/submit]";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ caseId: string }> }
) {
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
      .select("id, status, photo_checklist_config")
      .eq("case_id", caseId)
      .maybeSingle();
    if (!details) {
      return NextResponse.json(
        { ok: false, error: "Surgery upload not found for this case" },
        { status: 404 }
      );
    }
    if (details.status === "submitted") {
      return NextResponse.json({ ok: true, alreadySubmitted: true });
    }

    // Enforce required photo checklist using THIS case's resolved checklist
    // (per-case snapshot; null falls back to the base HairAudit checklist).
    // Server-side validation is authoritative — never trust the client here.
    const { data: uploads } = await admin
      .from("uploads")
      .select("type")
      .eq("case_id", caseId);
    const missing = getMissingRequiredSurgerySlots(
      uploads ?? [],
      details.photo_checklist_config
    );
    if (missing.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required photos",
          missingRequiredSlots: missing,
          missingRequiredLabels: missing.map((slot) => SLOT_LABELS.get(slot) ?? slot),
        },
        { status: 422 }
      );
    }

    const { data: updated, error: updErr } = await admin
      .from("surgery_upload_details")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        submitted_by: user.id,
      })
      .eq("case_id", caseId)
      .select("*")
      .single();

    if (updErr) {
      console.error(LOG_PREFIX, "submit update failed", { caseId, error: updErr.message });
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, details: updated });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json({ ok: false, error: "Could not submit" }, { status: 500 });
  }
}
