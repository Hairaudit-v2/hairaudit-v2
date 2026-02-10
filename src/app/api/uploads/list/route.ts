
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? "";

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";

  const { data: uploads, error } = await supabase
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Only patient photos
  const patient = (uploads ?? []).filter((u) => String(u.type ?? "").startsWith("patient_photo:"));

  // Create signed URLs (so UI can show thumbnails)
  const signed = await Promise.all(
    patient.map(async (u) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(String(u.storage_path), 60 * 10);
      return { ...u, signedUrl: data?.signedUrl ?? null };
    })
  );

  // Group by category
  const byCategory: Record<string, any[]> = {};
  for (const u of signed) {
    const cat = u?.metadata?.category ?? String(u.type).split(":")[1] ?? "uncategorized";
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(u);
  }

  return NextResponse.json({ ok: true, byCategory, uploads: signed });
}
