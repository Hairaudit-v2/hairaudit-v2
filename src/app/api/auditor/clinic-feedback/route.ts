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

export type ClinicFeedbackItem = {
  type: "override" | "section_feedback";
  caseId: string;
  reportId: string;
  sectionOrDomainKey: string;
  note: string;
  createdAt: string;
  visibilityScope: string;
  manualScore?: number;
  aiScore?: number;
};

/**
 * GET ?caseId=&reportId= — clinic-facing feedback for one case/report.
 * GET (no params) — all clinic-visible feedback for the current clinic (dashboard list).
 * Returns only notes with visibility_scope = included_in_clinic_feedback.
 */
export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { searchParams } = new URL(req.url);
    const caseIdParam = searchParams.get("caseId")?.trim();
    const reportIdParam = searchParams.get("reportId")?.trim();

    if (caseIdParam && reportIdParam) {
      const [
        { data: overrides },
        { data: feedback },
      ] = await Promise.all([
        admin
          .from("audit_score_overrides")
          .select("domain_key, override_note, visibility_scope, manual_score, ai_score, ai_weighted_score, manual_weighted_score, delta_score, created_at")
          .eq("case_id", caseIdParam)
          .eq("report_id", reportIdParam),
        admin
          .from("audit_section_feedback")
          .select("section_key, feedback_note, visibility_scope, feedback_type, created_at")
          .eq("case_id", caseIdParam)
          .eq("report_id", reportIdParam),
      ]);

      const clinicOverrides = filterClinicVisibleOverrides((overrides ?? []) as OverrideRowWithVisibility[]);
      const clinicFeedback = filterClinicVisibleSectionFeedback((feedback ?? []) as SectionFeedbackRow[]);

      return NextResponse.json({
        ok: true,
        overrides: clinicOverrides,
        sectionFeedback: clinicFeedback,
      });
    }

    // List all clinic-visible feedback for the current user's clinic
    const userEmail = String(user.email ?? "").toLowerCase();
    const { data: clinicByUser } = await admin
      .from("clinic_profiles")
      .select("id")
      .eq("linked_user_id", user.id)
      .limit(1)
      .maybeSingle();
    const { data: clinicByEmail } = !clinicByUser && userEmail
      ? await admin.from("clinic_profiles").select("id").eq("clinic_email", userEmail).limit(1).maybeSingle()
      : { data: null };
    const clinicProfileId = (clinicByUser ?? clinicByEmail)?.id;
    if (!clinicProfileId) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const { data: requests } = await admin
      .from("case_contribution_requests")
      .select("case_id")
      .eq("clinic_profile_id", clinicProfileId);
    const caseIds = [...new Set((requests ?? []).map((r) => String((r as { case_id: string }).case_id)).filter(Boolean))];
    if (caseIds.length === 0) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const { data: reports } = await admin
      .from("reports")
      .select("id, case_id, version")
      .in("case_id", caseIds)
      .order("version", { ascending: false });
    const latestReportByCase = new Map<string, { id: string; case_id: string }>();
    for (const r of reports ?? []) {
      const cid = String((r as { case_id: string }).case_id);
      if (!cid || latestReportByCase.has(cid)) continue;
      latestReportByCase.set(cid, r as { id: string; case_id: string });
    }
    const reportIds = [...latestReportByCase.values()].map((r) => r.id);
    if (reportIds.length === 0) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const [
      { data: overridesAll },
      { data: feedbackAll },
    ] = await Promise.all([
      admin
        .from("audit_score_overrides")
        .select("case_id, report_id, domain_key, override_note, visibility_scope, manual_score, ai_score, created_at")
        .in("report_id", reportIds)
        .eq("visibility_scope", "included_in_clinic_feedback"),
      admin
        .from("audit_section_feedback")
        .select("case_id, report_id, section_key, feedback_note, visibility_scope, created_at")
        .in("report_id", reportIds)
        .eq("visibility_scope", "included_in_clinic_feedback"),
    ]);

    const items: ClinicFeedbackItem[] = [];
    for (const o of overridesAll ?? []) {
      const row = o as { case_id: string; report_id: string; domain_key: string; override_note: string | null; visibility_scope: string; manual_score?: number; ai_score?: number; created_at?: string };
      items.push({
        type: "override",
        caseId: row.case_id,
        reportId: row.report_id,
        sectionOrDomainKey: row.domain_key,
        note: row.override_note ?? "",
        createdAt: row.created_at ?? new Date().toISOString(),
        visibilityScope: row.visibility_scope,
        manualScore: row.manual_score,
        aiScore: row.ai_score,
      });
    }
    for (const f of feedbackAll ?? []) {
      const row = f as { case_id: string; report_id: string; section_key: string; feedback_note: string; visibility_scope: string; created_at?: string };
      items.push({
        type: "section_feedback",
        caseId: row.case_id,
        reportId: row.report_id,
        sectionOrDomainKey: row.section_key,
        note: row.feedback_note,
        createdAt: row.created_at ?? new Date().toISOString(),
        visibilityScope: row.visibility_scope,
      });
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ ok: true, items });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? "Server error") }, { status: 500 });
  }
}
