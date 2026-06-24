import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { rebuildReportPdfForReport } from "@/lib/reports/rebuildReportPdf";
import { REPORT_PDF_MISSING_REGEN_ERROR } from "@/lib/reports/reportPdfDownloadRecovery";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabaseAuth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
      return NextResponse.json({ ok: false, error: "Forbidden: auditors only" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const caseId = String(body?.caseId ?? "").trim();
    const reportId = String(body?.reportId ?? "").trim();
    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });

    let reportQuery = admin
      .from("reports")
      .select("id, case_id, version, status, summary")
      .eq("case_id", caseId);
    if (reportId) {
      reportQuery = reportQuery.eq("id", reportId);
    } else {
      reportQuery = reportQuery.order("version", { ascending: false }).limit(1);
    }
    const { data: report, error: reportErr } = await reportQuery.maybeSingle();
    if (reportErr) {
      return NextResponse.json({ ok: false, error: reportErr.message }, { status: 500 });
    }
    if (!report) {
      return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
    }

    const version = Number((report as { version?: number }).version ?? 0);
    if (version < 1) {
      return NextResponse.json({ ok: false, error: REPORT_PDF_MISSING_REGEN_ERROR }, { status: 422 });
    }

    const summary = (report as { summary?: unknown }).summary;
    if (!summary || typeof summary !== "object") {
      return NextResponse.json({ ok: false, error: REPORT_PDF_MISSING_REGEN_ERROR }, { status: 422 });
    }

    const result = await rebuildReportPdfForReport({
      reportId: String((report as { id: string }).id),
      caseId,
      version,
      baseUrl: new URL(req.url).origin,
    });

    return NextResponse.json({ ok: true, pdfPath: result.pdfPath, reportId: (report as { id: string }).id });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    const msg = String((e as Error)?.message ?? e);
    if (code === "AUDIT_NOT_READY" || /AUDIT_NOT_READY/i.test(msg)) {
      return NextResponse.json({ ok: false, error: REPORT_PDF_MISSING_REGEN_ERROR }, { status: 422 });
    }
    console.error("[api/auditor/rebuild-pdf] unexpected error", { message: msg });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Rebuild failed" },
      { status: 500 }
    );
  }
}
