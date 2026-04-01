import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";

export const runtime = "nodejs";

/**
 * Signed URL for academy training photos only. Requires session + access to the case in the path.
 * Path must be: academy/training-cases/{caseId}/...
 */
export async function GET(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path || path.includes("..")) {
    return NextResponse.json({ ok: false, error: "Missing or invalid path" }, { status: 400 });
  }

  if (!path.startsWith("academy/training-cases/")) {
    return NextResponse.json({ ok: false, error: "Path not allowed" }, { status: 400 });
  }

  const parts = path.split("/").filter(Boolean);
  // academy / training-cases / {caseId} / ...
  if (parts.length < 3 || parts[0] !== "academy" || parts[1] !== "training-cases") {
    return NextResponse.json({ ok: false, error: "Path not allowed" }, { status: 400 });
  }

  const caseId = parts[2];
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(caseId)) {
    return NextResponse.json({ ok: false, error: "Invalid case id" }, { status: 400 });
  }

  const auth = await createSupabaseAuthServerClient();
  const { data: canRead } = await auth.from("training_cases").select("id").eq("id", caseId).maybeSingle();
  if (!canRead) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 120);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
