// PATCH /api/surgery-upload/cases/[caseId] — save surgery details (autosave/draft)
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { sanitizeSurgeryDetailsInput } from "@/lib/surgeryUpload/fields";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/cases/:id]";

export async function PATCH(
  req: Request,
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

    const { data: existing } = await admin
      .from("surgery_upload_details")
      .select("id, status")
      .eq("case_id", caseId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Surgery upload not found for this case" },
        { status: 404 }
      );
    }
    if (existing.status === "submitted") {
      return NextResponse.json(
        { ok: false, error: "This surgery upload has been submitted and cannot be edited." },
        { status: 409 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sanitized = sanitizeSurgeryDetailsInput(body);
    if ("error" in sanitized) {
      return NextResponse.json({ ok: false, error: sanitized.error }, { status: 400 });
    }

    if (Object.keys(sanitized.values).length === 0) {
      return NextResponse.json({ ok: true, details: null, noop: true });
    }

    const { data: updated, error: updErr } = await admin
      .from("surgery_upload_details")
      .update(sanitized.values)
      .eq("case_id", caseId)
      .select("*")
      .single();

    if (updErr) {
      console.error(LOG_PREFIX, "update failed", { caseId, error: updErr.message });
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, details: updated });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json({ ok: false, error: "Could not save changes" }, { status: 500 });
  }
}
