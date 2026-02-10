import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// GET /api/uploads/signed-url?uploadId=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const uploadId = url.searchParams.get("uploadId");

  if (!uploadId) {
    return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });
  }

  // Auth check
  const supabaseAuth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load upload + case
  const { data: upload } = await admin
    .from("uploads")
    .select("id, storage_path, case_id")
    .eq("id", uploadId)
    .maybeSingle();

  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: c } = await admin
    .from("cases")
    .select("user_id")
    .eq("id", upload.case_id)
    .maybeSingle();

  if (!c || c.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Create signed URL (15 min)
  const { data, error } = await admin.storage
    .from("case-files")
    .createSignedUrl(upload.storage_path, 60 * 15);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
