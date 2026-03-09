import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  filterClinicVisibleOverrides,
  filterClinicVisibleSectionFeedback,
  type OverrideRowWithVisibility,
  type SectionFeedbackRow,
} from "@/lib/auditor/visibility";

export const runtime = "nodejs";

/**
 * GET ?caseId=&reportId= — clinic-facing feedback only.
 * Returns only notes/overrides with visibility_scope = included_in_clinic_feedback.
 * Used by clinic dashboard or exports; internal_only notes never leak here.
 */
export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId")?.trim();
    const reportId = searchParams.get("reportId")?.trim();
    if (!caseId || !reportId) {
      return NextResponse.json({ ok: false, error: "Missing caseId or reportId" }, { status: 400 });
    }

    const [
      { data: overrides },
      { data: feedback },
    ] = await Promise.all([
      admin
        .from("audit_score_overrides")
        .select("domain_key, override_note, visibility_scope, manual_score, ai_score")
        .eq("case_id", caseId)
        .eq("report_id", reportId),
      admin
        .from("audit_section_feedback")
        .select("section_key, feedback_note, visibility_scope, feedback_type")
        .eq("case_id", caseId)
        .eq("report_id", reportId),
    ]);

    const clinicOverrides = filterClinicVisibleOverrides((overrides ?? []) as OverrideRowWithVisibility[]);
    const clinicFeedback = filterClinicVisibleSectionFeedback((feedback ?? []) as SectionFeedbackRow[]);

    return NextResponse.json({
      ok: true,
      overrides: clinicOverrides,
      sectionFeedback: clinicFeedback,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? "Server error") }, { status: 500 });
  }
}
