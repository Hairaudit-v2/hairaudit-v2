import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { buildPatientSafeSummaryObservations } from "@/lib/reports/patientSafeSummary";
import {
  getPatientSafeSummaryTranslationOpsState,
  refreshPatientSafeSummaryNarrativeTranslation,
  setPatientSafeSummaryNarrativeReviewStatus,
} from "@/lib/reports/patientSafeSummaryNarrativeTranslation";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/constants";

export const runtime = "nodejs";

async function assertAuditor() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
    return { error: NextResponse.json({ ok: false, error: "Forbidden: auditors only" }, { status: 403 }) };
  }

  return { admin, userId: user.id };
}

async function loadCaseReportContext(admin: ReturnType<typeof createSupabaseAdminClient>, caseId: string) {
  const latestReportRes = await admin
    .from("reports")
    .select("id, version, summary")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestReportRes.error) return { error: latestReportRes.error.message };
  const latestReport = latestReportRes.data;
  if (!latestReport) return { error: "No report available for case." };

  const summary = (latestReport.summary as Record<string, unknown> | null) ?? {};
  const observations = buildPatientSafeSummaryObservations(summary);
  return {
    reportId: latestReport.id as string,
    reportVersion: Number(latestReport.version ?? 0),
    observations,
  };
}

export async function GET(req: Request) {
  try {
    const auth = await assertAuditor();
    if ("error" in auth) return auth.error;
    const { admin } = auth;

    const { searchParams } = new URL(req.url);
    const caseId = String(searchParams.get("caseId") ?? "").trim();
    const locale = normalizeLocale(searchParams.get("locale")) as SupportedLocale;
    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });

    const ctx = await loadCaseReportContext(admin, caseId);
    if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: 404 });

    const state = await getPatientSafeSummaryTranslationOpsState({
      db: admin,
      caseId,
      reportId: ctx.reportId,
      reportVersion: ctx.reportVersion,
      requestedLocale: locale,
      sourceObservations: ctx.observations,
    });

    return NextResponse.json({ ok: true, state });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await assertAuditor();
    if ("error" in auth) return auth.error;
    const { admin, userId } = auth;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const caseId = String(body?.caseId ?? "").trim();
    const locale = normalizeLocale(typeof body?.locale === "string" ? body.locale : null) as SupportedLocale;
    const action = String(body?.action ?? "").trim();
    const reviewNotes = typeof body?.reviewNotes === "string" ? body.reviewNotes : null;

    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    if (!["refresh", "approve", "reject", "reset_review"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const ctx = await loadCaseReportContext(admin, caseId);
    if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: 404 });

    if (action === "refresh") {
      const presentation = await refreshPatientSafeSummaryNarrativeTranslation({
        db: admin,
        caseId,
        reportId: ctx.reportId,
        reportVersion: ctx.reportVersion,
        requestedLocale: locale,
        sourceObservations: ctx.observations,
      });
      return NextResponse.json({ ok: true, presentation });
    }

    const reviewStatus =
      action === "approve" ? "approved" : action === "reject" ? "rejected" : "not_reviewed";
    const review = await setPatientSafeSummaryNarrativeReviewStatus({
      db: admin,
      reportId: ctx.reportId,
      targetLocale: locale,
      reviewStatus,
      reviewAction: action as "approve" | "reject" | "reset_review",
      reviewerId: userId,
      reviewNotes:
        reviewStatus === "approved"
          ? reviewNotes ?? "Approved via auditor pilot ops panel."
          : reviewStatus === "rejected"
            ? reviewNotes
            : reviewNotes ?? "Review status reset via auditor pilot ops panel.",
    });
    if (!review.ok) return NextResponse.json({ ok: false, error: review.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
