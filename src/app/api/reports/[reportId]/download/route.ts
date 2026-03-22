import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { reportPdfPathMatchesCase } from "@/lib/reports/pdfPathCaseId";
import { fetchReportPdfFromStorage } from "@/lib/reports/fetchReportPdfFromStorage";

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

    const admin = tryCreateSupabaseAdminClient();
    const db = admin ?? supabaseAuth;

    const { data: report, error: reportErr } = await db
      .from("reports")
      .select("id, case_id, pdf_path, version")
      .eq("id", reportId)
      .maybeSingle();

    if (reportErr) {
      console.error("[reports/download] report lookup error", { reportId, message: reportErr.message });
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const pdfPath = String(report.pdf_path ?? "").trim();
    if (!pdfPath) {
      return NextResponse.json({ error: "Report file not ready" }, { status: 404 });
    }

    const caseId = String(report.case_id ?? "");
    if (!reportPdfPathMatchesCase(pdfPath, caseId)) {
      console.error("[reports/download] pdf path does not match case", { reportId, caseId });
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const { data: caseRow, error: caseErr } = await db
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr) {
      console.error("[reports/download] case lookup error", { caseId, message: caseErr.message });
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    const allowed = await canAccessCase(user.id, caseRow ?? null);
    if (!caseRow || !allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bucket = process.env.CASE_FILES_BUCKET || "case-files";
    const storage = (admin ?? supabaseAuth).storage;

    const file = await fetchReportPdfFromStorage(storage, bucket, pdfPath);
    if ("error" in file) {
      console.error("[reports/download] storage fetch failed", { reportId, pdfPath });
      return NextResponse.json({ error: "Could not load report file" }, { status: 500 });
    }

    const filename = safeDownloadFilename(report.id);
    const { blob } = file;
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "Content-Length": String(blob.size),
    });

    // Stream the PDF so we avoid buffering the whole file as ArrayBuffer and start sending sooner on large reports.
    const body = typeof blob.stream === "function" ? blob.stream() : blob;
    return new NextResponse(body, { status: 200, headers });
  } catch (e) {
    console.error("[reports/download] unexpected error", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
