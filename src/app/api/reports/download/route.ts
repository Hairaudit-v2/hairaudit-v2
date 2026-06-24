/**
 * Legacy query form: `GET /api/reports/download?reportId=…`
 * Prefer `GET /api/reports/[reportId]/download` (same authorization + streaming behaviour).
 */
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { loadAuthorizedReportPdfDownloadContext } from "@/lib/reports/reportAccess";
import { fetchReportPdfWithRecovery } from "@/lib/reports/reportPdfDownloadRecovery";

function safeDownloadFilename(reportId: string) {
  const id = String(reportId ?? "").replace(/[^a-zA-Z0-9-]/g, "");
  return id ? `hairaudit-report-${id}.pdf` : "hairaudit-report.pdf";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get("reportId")?.trim();
    if (!reportId) {
      return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
    }

    const supabaseAuth = await createSupabaseAuthServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authz = await loadAuthorizedReportPdfDownloadContext({
      userId: user.id,
      reportId,
      supabaseAuth,
    });

    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    const file = await fetchReportPdfWithRecovery(authz);
    if (!file.ok) {
      return NextResponse.json({ error: file.error }, { status: file.status });
    }

    const filename = safeDownloadFilename(authz.report.id);
    const { blob } = file;
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "Content-Length": String(blob.size),
    });

    const body = typeof blob.stream === "function" ? blob.stream() : blob;
    return new NextResponse(body, { status: 200, headers });
  } catch (e) {
    console.error("[api/reports/download] unexpected error", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
