import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";
import { syncBatchBulkImagesToUploads } from "@/lib/hair-audit/bulkUpload/syncToUploads";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { batchId } = await ctx.params;
  const admin = createSupabaseAdminClient();

  const { data: batch, error: batchErr } = await admin
    .from("hair_audit_case_batches")
    .select("id")
    .eq("id", batchId)
    .maybeSingle();

  if (batchErr) return NextResponse.json({ ok: false, error: batchErr.message }, { status: 500 });
  if (!batch) return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });

  const sync = await syncBatchBulkImagesToUploads(admin, batchId, auth.userId);

  return NextResponse.json({
    ok: true,
    batchId,
    synced: sync.synced,
    updated: sync.updated,
    skipped: sync.skipped,
    removed: sync.removed,
    errors: sync.errors,
    caseIds: sync.caseIds,
  });
}
