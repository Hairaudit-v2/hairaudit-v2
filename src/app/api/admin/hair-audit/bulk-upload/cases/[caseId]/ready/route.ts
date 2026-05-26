import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";
import { computeCaseReadiness } from "@/lib/hair-audit/bulkUpload/validation";
import { syncBulkImagesToUploads } from "@/lib/hair-audit/bulkUpload/syncToUploads";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { caseId } = await ctx.params;
  const admin = createSupabaseAdminClient();

  const { data: caseRow, error: caseErr } = await admin
    .from("cases")
    .select(
      "id, batch_id, patient_reference, graft_count, intake_status, status, submitted_at, user_id, doctor_id, clinic_id"
    )
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr) return NextResponse.json({ ok: false, error: caseErr.message }, { status: 500 });
  if (!caseRow?.batch_id) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
  if (caseRow.submitted_at || caseRow.status === "submitted") {
    return NextResponse.json({ ok: false, error: "Case already submitted" }, { status: 409 });
  }

  const { count: imageCount } = await admin
    .from("hair_audit_case_images")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);

  const readiness = computeCaseReadiness(
    {
      patient_reference: caseRow.patient_reference ?? "",
      graft_count: caseRow.graft_count,
    },
    imageCount ?? 0
  );

  if (!readiness.isReady) {
    return NextResponse.json(
      { ok: false, error: "Case is missing required fields", missingFields: readiness.missingFields },
      { status: 400 }
    );
  }

  const { data: images, error: imgErr } = await admin
    .from("hair_audit_case_images")
    .select("id, case_id, storage_path, file_name, mime_type, image_category")
    .eq("case_id", caseId);

  if (imgErr) return NextResponse.json({ ok: false, error: imgErr.message }, { status: 500 });

  const ownerId = caseRow.user_id ?? auth.userId;
  const sync = await syncBulkImagesToUploads(admin, caseId, ownerId, images ?? []);

  const { data: updated, error: updErr } = await admin
    .from("cases")
    .update({ intake_status: "ready_for_audit" })
    .eq("id", caseId)
    .select("id, intake_status")
    .single();

  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    case: updated,
    sync,
  });
}
