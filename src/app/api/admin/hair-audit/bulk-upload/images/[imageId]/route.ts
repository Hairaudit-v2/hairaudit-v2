import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";
import { refreshCaseIntakeStatus } from "@/lib/hair-audit/bulkUpload/caseIntake";
import { removeBulkImageFromUploads } from "@/lib/hair-audit/bulkUpload/syncToUploads";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ imageId: string }> }) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { imageId } = await ctx.params;
  const admin = createSupabaseAdminClient();

  const { data: image, error: loadErr } = await admin
    .from("hair_audit_case_images")
    .select("id, case_id, storage_path")
    .eq("id", imageId)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ ok: false, error: loadErr.message }, { status: 500 });
  if (!image) return NextResponse.json({ ok: false, error: "Image not found" }, { status: 404 });

  const sync = await removeBulkImageFromUploads(admin, image);

  const bucket = getCaseFilesBucketNameForReadOnlyUse();
  await admin.storage.from(bucket).remove([image.storage_path]);

  const { error: delErr } = await admin.from("hair_audit_case_images").delete().eq("id", imageId);
  if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });

  if (image.case_id) {
    await refreshCaseIntakeStatus(admin, image.case_id);
  }

  return NextResponse.json({ ok: true, sync });
}
