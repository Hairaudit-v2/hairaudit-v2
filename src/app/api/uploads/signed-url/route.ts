import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCaseAccess, requireUser } from "@/lib/auth/permissions";
import { parseCaseIdFromCaseFilesPath, storagePathBelongsToCase } from "@/lib/uploads/caseFilesPath";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const supabaseAuth = await createSupabaseAuthServerClient();
    const userGate = await requireUser(supabaseAuth);
    if (!userGate.ok) return userGate.response;

    const parsed = parseCaseIdFromCaseFilesPath(path);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const caseGate = await requireCaseAccess({
      userId: userGate.data.user.id,
      caseId: parsed.caseId,
      supabaseAuth,
    });
    if (!caseGate.ok) return caseGate.response;

    if (!storagePathBelongsToCase(parsed.caseId, path)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const bucket = process.env.CASE_FILES_BUCKET || "case-files";
    const admin = tryCreateSupabaseAdminClient();
    const storage = (admin ?? supabaseAuth).storage;

    const { data, error } = await storage.from(bucket).createSignedUrl(parsed.normalizedPath, 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? "Could not sign URL" }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    console.error("[uploads/signed-url] Error:", e);
    return NextResponse.json({ error: (e as Error)?.message ?? "Internal server error" }, { status: 500 });
  }
}
