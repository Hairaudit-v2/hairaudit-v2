import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";

export const runtime = "nodejs";

/**
 * POST — Set report-level auditor status (e.g. needs_more_evidence)
 * Stores in report summary.auditor_review for audit trail.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as any;
    const reportId = String(body?.reportId ?? "").trim();
    const action = String(body?.action ?? "").trim();

    if (!reportId) return NextResponse.json({ ok: false, error: "Missing reportId" }, { status: 400 });
    const validActions = ["needs_more_evidence", "clear_needs_more_evidence", "approve_final_report"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const { data: report, error: fetchErr } = await admin
      .from("reports")
      .select("id, summary")
      .eq("id", reportId)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
    if (!report) return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });

    const summary = (report.summary ?? {}) as Record<string, unknown>;
    const auditorReview = (summary.auditor_review ?? {}) as Record<string, unknown>;

    let nextReview: Record<string, unknown>;
    if (action === "needs_more_evidence") {
      nextReview = {
        ...auditorReview,
        needs_more_evidence: true,
        needs_more_evidence_at: new Date().toISOString(),
        needs_more_evidence_by: user.id,
      };
    } else if (action === "approve_final_report") {
      nextReview = {
        ...auditorReview,
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      };
    } else {
      nextReview = {
        ...auditorReview,
        needs_more_evidence: false,
        needs_more_evidence_cleared_at: new Date().toISOString(),
        needs_more_evidence_cleared_by: user.id,
      };
    }

    const nextSummary = { ...summary, auditor_review: nextReview };

    const updatePayload: Record<string, unknown> = { summary: nextSummary };
    if (action === "approve_final_report") {
      updatePayload.auditor_review_status = "completed";
    }

    const { error: updateErr } = await admin
      .from("reports")
      .update(updatePayload)
      .eq("id", reportId);

    if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "Server error") }, { status: 500 });
  }
}
