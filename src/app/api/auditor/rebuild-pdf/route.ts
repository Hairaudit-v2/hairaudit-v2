import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { rebuildReportPdfForReport, PdfRebuildNotReadyError } from "@/lib/reports/rebuildReportPdf";
import {
  evaluateReportPdfRebuildPreflight,
  formatPdfRebuildFailureMessage,
} from "@/lib/reports/reportPdfRebuildPreflight";

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

    const preflight = await evaluateReportPdfRebuildPreflight({
      caseId,
      reportId: reportId || undefined,
      supabase: admin,
    });

    if (!preflight.ready || !preflight.reportId || preflight.reportVersion < 1) {
      const message = formatPdfRebuildFailureMessage(preflight.diagnostics);
      return NextResponse.json(
        {
          ok: false,
          message,
          missingFields: preflight.diagnostics.missingFields,
          diagnostics: preflight.diagnostics,
        },
        { status: 422 }
      );
    }

    const result = await rebuildReportPdfForReport({
      reportId: preflight.reportId,
      caseId,
      version: preflight.reportVersion,
      baseUrl: new URL(req.url).origin,
    });

    return NextResponse.json({
      ok: true,
      pdfPath: result.pdfPath,
      reportId: preflight.reportId,
    });
  } catch (e: unknown) {
    if (e instanceof PdfRebuildNotReadyError) {
      return NextResponse.json(
        {
          ok: false,
          message: e.message,
          missingFields: e.missingFields,
          diagnostics: e.diagnostics,
        },
        { status: 422 }
      );
    }

    const code = (e as { code?: string })?.code;
    const msg = String((e as Error)?.message ?? e);
    if (code === "AUDIT_NOT_READY" || /AUDIT_NOT_READY/i.test(msg)) {
      return NextResponse.json(
        {
          ok: false,
          message: msg,
          missingFields: ["auditSummaryIncomplete"],
        },
        { status: 422 }
      );
    }
    console.error("[api/auditor/rebuild-pdf] unexpected error", { message: msg });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Rebuild failed" },
      { status: 500 }
    );
  }
}
