import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

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
