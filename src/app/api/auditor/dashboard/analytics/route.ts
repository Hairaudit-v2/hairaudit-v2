import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import {
  getAuditKpis,
  getAuditPriorityBreakdown,
  getAuditStatusBreakdown,
  getAuditVolumeSeries,
  getRecentOperationalAudits,
  type DashboardRange,
} from "@/lib/dashboard/auditOperations";
import {
  derivePatientSafeSummaryQueueStatus,
  shouldFallbackToEnglishInQueue,
  type PatientSafeSummaryTranslationQueueItem,
} from "@/lib/reports/patientSafeSummaryTranslationQueue";

export const runtime = "nodejs";

function parseRange(value: string | null): DashboardRange {
  if (value === "today" || value === "7d" || value === "30d" || value === "90d") return value;
  return "7d";
}

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const range = parseRange(url.searchParams.get("range"));

    let contributionRequestsWaiting = 0;
    try {
      const { count, error: crErr } = await admin
        .from("case_contribution_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["clinic_request_pending", "clinic_request_sent", "clinic_viewed_request"])
        .is("contribution_received_at", null);
      if (!crErr && typeof count === "number") contributionRequestsWaiting = count;
    } catch {
      // optional table
    }

    const [kpis, volumeSeries, statusBreakdown, priorityBreakdown, operationalAudits] = await Promise.all([
      getAuditKpis(range),
      getAuditVolumeSeries(range),
      getAuditStatusBreakdown(range),
      getAuditPriorityBreakdown(range),
      getRecentOperationalAudits(range),
    ]);

    const { data: recentCases } = await admin
      .from("cases")
      .select("id, title, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    const caseIds = (recentCases ?? []).map((c) => String(c.id));
    const { data: allReports } = await admin
      .from("reports")
      .select("id, case_id, version, status, summary")
      .in("case_id", caseIds.length ? caseIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });

    const reportByCase = new Map<string, { id: string; version?: number | null }>();
    for (const r of allReports ?? []) {
      const cid = String(r.case_id);
      if (!reportByCase.has(cid)) {
        reportByCase.set(cid, { id: String(r.id), version: r.version ?? null });
      }
    }

    const latestReportIds = [...reportByCase.values()].map((r) => r.id);
    let translationRows: Array<{
      report_id: string;
      case_id: string;
      report_version: number;
      translation_status: string;
      review_status: string;
      updated_at: string | null;
      translated_at: string | null;
      reviewed_at: string | null;
    }> = [];

    if (latestReportIds.length > 0) {
      try {
        const trRes = await admin
          .from("report_narrative_translations")
          .select("report_id, case_id, report_version, translation_status, review_status, updated_at, translated_at, reviewed_at")
          .in("report_id", latestReportIds)
          .eq("section_id", "patientSafeSummaryNarrative")
          .eq("target_locale", "es");
        if (!trRes.error) translationRows = trRes.data ?? [];
      } catch {
        // optional
      }
    }

    const translationByReportId = new Map(translationRows.map((row) => [String(row.report_id), row]));
    const translationQueueItems: PatientSafeSummaryTranslationQueueItem[] = [];

    for (const c of recentCases ?? []) {
      const caseId = String(c.id);
      const report = reportByCase.get(caseId);
      if (!report) continue;
      const row = translationByReportId.get(report.id);
      const status = derivePatientSafeSummaryQueueStatus({
        hasTranslation: !!row,
        translationStatus: row?.translation_status as Parameters<typeof derivePatientSafeSummaryQueueStatus>[0]["translationStatus"],
        reviewStatus: row?.review_status as Parameters<typeof derivePatientSafeSummaryQueueStatus>[0]["reviewStatus"],
      });
      translationQueueItems.push({
        caseId,
        caseTitle: String(c.title ?? `Case ${caseId.slice(0, 8)}`),
        reportId: report.id,
        reportVersion: Number(row?.report_version ?? report.version ?? 0),
        targetLocale: "es",
        status,
        translationStatus: (row?.translation_status as PatientSafeSummaryTranslationQueueItem["translationStatus"]) ?? "not_available",
        reviewStatus: (row?.review_status as PatientSafeSummaryTranslationQueueItem["reviewStatus"]) ?? "not_available",
        fallbackCurrentlyEnglish: shouldFallbackToEnglishInQueue(status),
        updatedAt: row?.updated_at ?? null,
        translatedAt: row?.translated_at ?? null,
        reviewedAt: row?.reviewed_at ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      range,
      contributionRequestsWaiting,
      kpis,
      volumeSeries,
      statusBreakdown,
      priorityBreakdown,
      operationalAudits,
      translationQueueItems,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analytics load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
