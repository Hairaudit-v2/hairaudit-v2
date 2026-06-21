import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireCaseAccess,
  requirePatientCaseAccess,
  requireUser,
} from "@/lib/auth/permissions";
import { filterForensicAuditReports } from "@/lib/reports/forensicReportsFilter";
import { buildPatientCaseStatusPayload } from "@/lib/patient/patientProcessingView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { caseId } = await context.params;
    const trimmedCaseId = String(caseId ?? "").trim();
    if (!trimmedCaseId) {
      return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    }

    const supabase = await createSupabaseAuthServerClient();
    const userGate = await requireUser(supabase);
    if (!userGate.ok) return userGate.response;

    const accessGate = await requireCaseAccess({
      userId: userGate.data.user.id,
      caseId: trimmedCaseId,
      supabaseAuth: supabase,
    });
    if (!accessGate.ok) return accessGate.response;

    const patientGate = requirePatientCaseAccess(userGate.data.user.id, accessGate.data.case);
    if (!patientGate.ok) return patientGate.response;

    const admin = tryCreateSupabaseAdminClient();
    const db = admin ?? supabase;

    const { data: caseRow, error: caseError } = await db
      .from("cases")
      .select("id, status, submitted_at")
      .eq("id", trimmedCaseId)
      .maybeSingle();

    if (caseError) {
      return NextResponse.json({ error: caseError.message }, { status: 500 });
    }
    if (!caseRow) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const { data: reports, error: reportsError } = await db
      .from("reports")
      .select("id, pdf_path, report_kind, version")
      .eq("case_id", trimmedCaseId)
      .order("version", { ascending: false });

    if (reportsError) {
      return NextResponse.json({ error: reportsError.message }, { status: 500 });
    }

    const forensicReports = filterForensicAuditReports(reports ?? []);
    const latestReport = forensicReports[0] ?? null;
    const hasReportPdf = Boolean((latestReport as { pdf_path?: string } | null)?.pdf_path);

    const payload = buildPatientCaseStatusPayload({
      caseId: trimmedCaseId,
      caseStatus: String(caseRow.status ?? "draft"),
      hasReportPdf,
      submittedAt: (caseRow as { submitted_at?: string | null }).submitted_at ?? null,
      notificationEmail: userGate.data.user.email,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: String((error as Error)?.message ?? "Server error") },
      { status: 500 }
    );
  }
}
