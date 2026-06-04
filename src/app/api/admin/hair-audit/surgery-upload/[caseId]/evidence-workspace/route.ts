// PATCH /api/admin/hair-audit/surgery-upload/[caseId]/evidence-workspace — Stage 8
//
// Auditors update structured evidence-review workspace notes + flags only.
//
// REGRESSION GUARDS:
// - MUST NOT call POST /api/submit or emit case/submitted.
// - MUST NOT mutate cases.status or cases.submitted_at.
// - MUST NOT start the forensic / legacy audit pipeline.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { canTriggerAuditHandoff } from "@/lib/surgeryUpload/auditHandoff";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import {
  mergeEvidenceWorkspacePatch,
  parseEvidenceWorkspaceFlagsJson,
  workspaceFlagsToJsonb,
} from "@/lib/surgeryUpload/evidenceReviewWorkspace";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/admin/hair-audit/surgery-upload/evidence-workspace]";

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
    if (!canTriggerAuditHandoff(actor)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
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
      console.error(LOG_PREFIX, "load error", exErr.message);
      return NextResponse.json({ ok: false, error: "Could not load surgery upload." }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ ok: false, error: "No surgery upload for this case." }, { status: 404 });
    }

    const det = existing as SurgeryUploadDetails;
    const existingFlags = parseEvidenceWorkspaceFlagsJson(det.evidence_review_workspace_flags);
    const merged = mergeEvidenceWorkspacePatch(body, det.evidence_review_workspace_notes ?? null, existingFlags);
    if (!merged.ok) {
      return NextResponse.json({ ok: false, error: merged.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updateRow: Record<string, unknown> = {};

    if ("notes" in body) {
      updateRow.evidence_review_workspace_notes = merged.notes;
      updateRow.evidence_review_workspace_notes_updated_by = user.id;
      updateRow.evidence_review_workspace_notes_updated_at = now;
    }
    if ("flags" in body) {
      updateRow.evidence_review_workspace_flags = workspaceFlagsToJsonb(merged.flags);
      updateRow.evidence_review_workspace_flags_updated_by = user.id;
      updateRow.evidence_review_workspace_flags_updated_at = now;
    }

    const { data: updated, error: upErr } = await admin
      .from("surgery_upload_details")
      .update(updateRow)
      .eq("case_id", caseId)
      .select("*")
      .maybeSingle();

    if (upErr) {
      console.error(LOG_PREFIX, "update error", upErr.message);
      return NextResponse.json({ ok: false, error: "Could not save workspace." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, details: updated });
  } catch (e) {
    console.error(LOG_PREFIX, e);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
