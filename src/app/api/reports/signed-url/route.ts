import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";

export async function GET(req: Request) {
  try {
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
    let data: { signedUrl: string } | null = null;
    let storageError: Error | null = null;

    const { data: d1, error: e1 } = await admin.storage.from(bucket).createSignedUrl(pdfPath, 60);
    if (!e1 && d1?.signedUrl) {
      data = d1;
    } else {
      storageError = e1 as unknown as Error;
      // Fallback: caseSubmitted uses cases/{caseId}/reports/v{n}.pdf
      const parts = pdfPath.split("/");
      if (parts.length === 2 && parts[1]?.startsWith("v") && parts[1]?.endsWith(".pdf")) {
        const altPath = `cases/${parts[0]}/reports/${parts[1]}`;
        const { data: d2, error: e2 } = await admin.storage.from(bucket).createSignedUrl(altPath, 60);
        if (!e2 && d2?.signedUrl) data = d2;
        else if (e2) storageError = e2 as unknown as Error;
      }
    }

    if (storageError) {
      console.error("[reports/signed-url] Storage error:", storageError.message, { pdfPath, bucket });
      return NextResponse.json({ error: `Storage: ${storageError.message}` }, { status: 500 });
    }
    if (!data?.signedUrl) {
      return NextResponse.json({ error: "Could not generate download URL" }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    console.error("[reports/signed-url] Error:", e);
    return NextResponse.json({ error: (e as Error)?.message ?? "Internal server error" }, { status: 500 });
  }
}
