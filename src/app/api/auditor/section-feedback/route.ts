import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { isEligibleForManualReview } from "@/lib/auditor/eligibility";

export const runtime = "nodejs";

const FEEDBACK_TYPES = ["clarification", "improvement_suggestion", "evidence_gap", "quality_note", "benchmark_note", "other"] as const;
const VISIBILITY_SCOPES = ["internal_only", "included_in_report", "included_in_clinic_feedback"] as const;

/** GET ?caseId=&reportId= — list section feedback for a report */
export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId")?.trim();
    const reportId = searchParams.get("reportId")?.trim();
    if (!caseId || !reportId) {
      return NextResponse.json({ ok: false, error: "Missing caseId or reportId" }, { status: 400 });
    }

    const { data: rows, error } = await admin
      .from("audit_section_feedback")
      .select("*")
      .eq("case_id", caseId)
      .eq("report_id", reportId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, feedback: rows ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "Server error") }, { status: 500 });
  }
}

/** POST — create section feedback */
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
    const caseId = String(body?.caseId ?? "").trim();
    const reportId = String(body?.reportId ?? "").trim();
    const sectionKey = String(body?.sectionKey ?? "").trim();
    const feedbackType = String(body?.feedbackType ?? "").trim();
    const visibilityScope = String(body?.visibilityScope ?? "internal_only").trim();
    const feedbackNote = String(body?.feedbackNote ?? "").trim();

    if (!caseId || !reportId || !sectionKey || !feedbackNote) {
      return NextResponse.json({ ok: false, error: "Missing caseId, reportId, sectionKey, or feedbackNote" }, { status: 400 });
    }

    const { data: reportRow } = await admin.from("reports").select("auditor_review_eligibility").eq("id", reportId).maybeSingle();
    if (!reportRow || !isEligibleForManualReview((reportRow as { auditor_review_eligibility?: string }).auditor_review_eligibility)) {
      return NextResponse.json({ ok: false, error: "Report is not eligible for manual auditor review (score 60–89 or not unlocked)." }, { status: 403 });
    }

    if (!FEEDBACK_TYPES.includes(feedbackType as any)) {
      return NextResponse.json({ ok: false, error: "Invalid feedbackType" }, { status: 400 });
    }
    if (!VISIBILITY_SCOPES.includes(visibilityScope as any)) {
      return NextResponse.json({ ok: false, error: "Invalid visibilityScope" }, { status: 400 });
    }

    const { data: inserted, error } = await admin
      .from("audit_section_feedback")
      .insert({
        case_id: caseId,
        report_id: reportId,
        section_key: sectionKey,
        feedback_type: feedbackType,
        visibility_scope: visibilityScope,
        feedback_note: feedbackNote,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: inserted?.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "Server error") }, { status: 500 });
  }
}
