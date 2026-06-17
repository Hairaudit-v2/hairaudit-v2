import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCaseAccess, requireUser } from "@/lib/auth/permissions";
import { extractCaseIdFromPdfPath } from "@/lib/reports/pdfPathCaseId";
import { storagePathBelongsToReportCase } from "@/lib/reports/reportAccess";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pdfPath = searchParams.get("path");

    if (!pdfPath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

    const supabaseAuth = await createSupabaseAuthServerClient();
    const userGate = await requireUser(supabaseAuth);
    if (!userGate.ok) return userGate.response;

    const user = userGate.data.user;
    const caseId = extractCaseIdFromPdfPath(pdfPath);
    if (!caseId) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

    const caseGate = await requireCaseAccess({
      userId: user.id,
      caseId,
      supabaseAuth,
    });
    if (!caseGate.ok) return caseGate.response;

    if (!storagePathBelongsToReportCase(caseId, pdfPath)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const bucket = getCaseFilesBucketNameForReadOnlyUse();
    let data: { signedUrl: string } | null = null;
    let storageError: Error | null = null;

    const admin = tryCreateSupabaseAdminClient();
    const storage = (admin ?? supabaseAuth).storage;
    const { data: d1, error: e1 } = await storage.from(bucket).createSignedUrl(pdfPath, 60);
    if (!e1 && d1?.signedUrl) {
      data = d1;
    } else {
      storageError = e1 as unknown as Error;
      const parts = pdfPath.split("/");
      if (parts.length === 2 && parts[1]?.startsWith("v") && parts[1]?.endsWith(".pdf")) {
        const altPath = `cases/${parts[0]}/reports/${parts[1]}`;
        if (storagePathBelongsToReportCase(caseId, altPath)) {
          const { data: d2, error: e2 } = await storage.from(bucket).createSignedUrl(altPath, 60);
          if (!e2 && d2?.signedUrl) data = d2;
          else if (e2) storageError = e2 as unknown as Error;
        }
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
