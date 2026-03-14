import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";

export const runtime = "nodejs";

type Action =
  | "mark_in_progress"
  | "mark_needs_manual_review"
  | "request_more_information"
  | "escalate_second_reviewer"
  | "suppress_public_visibility"
  | "archive"
  | "delete";

export async function POST(req: Request) {
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

    const body = (await req.json().catch(() => null)) as { caseId?: string; action?: Action; reason?: string } | null;
    const caseId = String(body?.caseId ?? "").trim();
    const action = String(body?.action ?? "").trim() as Action;
    const reason = String(body?.reason ?? "").trim();
    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    if (
      ![
        "mark_in_progress",
        "mark_needs_manual_review",
        "request_more_information",
        "escalate_second_reviewer",
        "suppress_public_visibility",
        "archive",
        "delete",
      ].includes(action)
    ) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const { data: foundCase, error: caseErr } = await admin
      .from("cases")
      .select("id, deleted_at, archived_at")
      .eq("id", caseId)
      .maybeSingle();
    if (caseErr) return NextResponse.json({ ok: false, error: caseErr.message }, { status: 500 });
    if (!foundCase) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });

    const now = new Date().toISOString();

    if (action === "mark_in_progress") {
      const { error: updErr } = await admin
        .from("cases")
        .update({
          assigned_auditor_id: user.id,
          auditor_started_at: now,
          auditor_last_edited_at: now,
          updated_at: now,
        })
        .eq("id", caseId)
        .is("deleted_at", null);

      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "archive") {
      const { error: updErr } = await admin
        .from("cases")
        .update({
          archived_at: now,
          archived_by: user.id,
          archived_reason: reason || "Archived by auditor",
          auditor_last_edited_at: now,
          updated_at: now,
        })
        .eq("id", caseId)
        .is("deleted_at", null);

      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "suppress_public_visibility") {
      const { error: updErr } = await admin
        .from("cases")
        .update({
          visibility_scope: "internal",
          auditor_last_edited_at: now,
          updated_at: now,
        })
        .eq("id", caseId)
        .is("deleted_at", null);
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      if (!reason) {
        return NextResponse.json({ ok: false, error: "Delete reason is required." }, { status: 400 });
      }
      const { error: updErr } = await admin
        .from("cases")
        .update({
          deleted_at: now,
          deleted_by: user.id,
          delete_reason: reason,
          archived_at: now,
          archived_by: user.id,
          archived_reason: "Deleted by auditor",
          auditor_last_edited_at: now,
          updated_at: now,
        })
        .eq("id", caseId);

      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const { data: latestReport, error: reportErr } = await admin
      .from("reports")
      .select("id, summary")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reportErr) return NextResponse.json({ ok: false, error: reportErr.message }, { status: 500 });
    if (!latestReport) return NextResponse.json({ ok: false, error: "No report found for case." }, { status: 409 });

    const summary = (latestReport.summary ?? {}) as Record<string, unknown>;
    const auditorReview = (summary.auditor_review ?? {}) as Record<string, unknown>;
    const shouldRequestMoreInfo = action === "request_more_information";
    const nextSummary = {
      ...summary,
      auditor_review: {
        ...auditorReview,
        needs_more_evidence: shouldRequestMoreInfo ? true : Boolean(auditorReview?.needs_more_evidence),
        needs_more_evidence_at:
          shouldRequestMoreInfo ? now : (auditorReview?.needs_more_evidence_at as string | null | undefined) ?? null,
        needs_more_evidence_by:
          shouldRequestMoreInfo ? user.id : (auditorReview?.needs_more_evidence_by as string | null | undefined) ?? null,
        needs_more_evidence_reason:
          shouldRequestMoreInfo
            ? reason || "Auditor requested more information."
            : (auditorReview?.needs_more_evidence_reason as string | null | undefined) ?? null,
        needs_manual_review: action === "mark_needs_manual_review" ? true : auditorReview?.needs_manual_review,
        escalated_second_reviewer: action === "escalate_second_reviewer" ? true : auditorReview?.escalated_second_reviewer,
        escalated_second_reviewer_at:
          action === "escalate_second_reviewer" ? now : (auditorReview?.escalated_second_reviewer_at as string | null | undefined) ?? null,
      },
    };

    const { error: updReportErr } = await admin
      .from("reports")
      .update({ summary: nextSummary, auditor_review_status: "in_review", updated_at: now })
      .eq("id", latestReport.id);
    if (updReportErr) return NextResponse.json({ ok: false, error: updReportErr.message }, { status: 500 });

    const { error: updCaseErr } = await admin
      .from("cases")
      .update({
        assigned_auditor_id: user.id,
        auditor_started_at: now,
        auditor_last_edited_at: now,
        updated_at: now,
      })
      .eq("id", caseId);
    if (updCaseErr) return NextResponse.json({ ok: false, error: updCaseErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
