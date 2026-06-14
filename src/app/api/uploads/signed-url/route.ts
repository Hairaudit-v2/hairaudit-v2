import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireAuthenticatedUser,
  requireCaseAccess,
} from "@/lib/security/caseAccess.server";
import { gateUploadSignedUrlStoragePath } from "@/lib/uploads/caseFilesPath";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    const pathGate = gateUploadSignedUrlStoragePath(path, searchParams.get("caseId"));
    if (!pathGate.ok) {
      return NextResponse.json({ error: pathGate.error }, { status: pathGate.status });
    }

    const supabaseAuth = await createSupabaseAuthServerClient();
    const userGate = await requireAuthenticatedUser(supabaseAuth);
    if (!userGate.ok) return userGate.response;

    const caseGate = await requireCaseAccess({
      userId: userGate.data.user.id,
      caseId: pathGate.caseId,
      supabaseAuth,
    });
    if (!caseGate.ok) return caseGate.response;

    const bucket = process.env.CASE_FILES_BUCKET || "case-files";
    const admin = tryCreateSupabaseAdminClient();
    const storage = (admin ?? supabaseAuth).storage;

    const { data, error } = await storage.from(bucket).createSignedUrl(pathGate.normalizedPath, 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? "Could not sign URL" }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    console.error("[uploads/signed-url] Error:", e);
    return NextResponse.json({ error: (e as Error)?.message ?? "Internal server error" }, { status: 500 });
  }
}
