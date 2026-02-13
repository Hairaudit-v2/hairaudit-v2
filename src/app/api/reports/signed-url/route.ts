import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pdfPath = searchParams.get("path");

  if (!pdfPath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const supabaseAuth = await createSupabaseAuthServerClient();
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caseId = pdfPath.split("/")[0];
  const admin = createSupabaseAdminClient();
  const { data: c } = await admin.from("cases").select("id, user_id, patient_id, doctor_id, clinic_id").eq("id", caseId).maybeSingle();
  const allowed = await canAccessCase(user.id, c ?? null);
  if (!c || !allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(pdfPath, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Could not generate download URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
