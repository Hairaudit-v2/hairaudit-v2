import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const supabaseAdmin = () => createSupabaseAdminClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const supabase = supabaseAdmin();

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
