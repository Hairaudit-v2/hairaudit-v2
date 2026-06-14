import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { fetchReportPdfFromStorage } from "@/lib/reports/fetchReportPdfFromStorage";
import { loadAuthorizedReportPdfDownloadContext } from "@/lib/reports/reportAccess";

function safeDownloadFilename(reportId: string) {
  const id = String(reportId ?? "").replace(/[^a-zA-Z0-9-]/g, "");
  return id ? `hairaudit-report-${id}.pdf` : "hairaudit-report.pdf";
}

export async function GET(_req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await ctx.params;
    if (!reportId?.trim()) {
      return NextResponse.json({ error: "Missing report" }, { status: 400 });
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

    const file = await fetchReportPdfFromStorage(authz.storage, authz.bucket, authz.pdfPath);
    if ("error" in file) {
      console.error("[reports/download] storage fetch failed", { reportId, pdfPath: authz.pdfPath });
      return NextResponse.json({ error: "Could not load report file" }, { status: 500 });
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
    console.error("[reports/download] unexpected error", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
