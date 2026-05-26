import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path || path.includes("..") || !path.startsWith("cases/bulk/")) {
    return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 });
  }

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 120);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
