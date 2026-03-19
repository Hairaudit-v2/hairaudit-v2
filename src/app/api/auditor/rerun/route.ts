import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { inngest } from "@/lib/inngest/client";

export const runtime = "nodejs";

const ACTION_TYPES = [
  "regenerate_ai_audit",
  "regenerate_scoring",
  "regenerate_graft_integrity",
  "regenerate_evidence_analysis",
  "rebuild_pdf",
  "regenerate_report_generation",
  "full_reaudit",
  "full_reaudit_latest_submission",
  "full_reaudit_with_followup_linkage",
] as const;
const REASONS = [
  "new_uploads",
  "new_doctor_data",
  "failed_previous_run",
  "updated_model_or_prompt",
  "auditor_review_request",
  "data_inconsistency",
] as const;

type ActionType = (typeof ACTION_TYPES)[number];
type Reason = (typeof REASONS)[number];

function normalizeAction(action: ActionType): "regenerate_ai_audit" | "regenerate_graft_integrity" | "rebuild_pdf" | "full_reaudit" {
  if (action === "regenerate_scoring") return "regenerate_ai_audit";
  if (action === "regenerate_evidence_analysis") return "regenerate_graft_integrity";
  if (action === "regenerate_report_generation") return "rebuild_pdf";
  if (action === "full_reaudit_latest_submission" || action === "full_reaudit_with_followup_linkage") return "full_reaudit";
  return action;
}

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
      return NextResponse.json({ ok: false, error: "Forbidden: auditors only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId")?.trim();
    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });

    const { data, error } = await admin
      .from("audit_rerun_log")
      .select("id, case_id, action_type, triggered_by, triggered_role, reason, notes, source_report_version, target_report_version, status, error, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    let tracking: Record<string, unknown> | null = null;
    try {
      const trackingRes = await admin
        .from("cases")
        .select("rerun_count, last_rerun_at, last_rerun_by, processing_log")
        .eq("id", caseId)
        .maybeSingle();
      tracking = (trackingRes.data ?? null) as Record<string, unknown> | null;
    } catch {
      tracking = null;
    }
    return NextResponse.json({ ok: true, items: data ?? [], tracking: tracking ?? null });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
      return NextResponse.json({ ok: false, error: "Forbidden: auditors only" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const caseId = String(body?.caseId ?? "").trim();
    const action = String(body?.action ?? "").trim() as ActionType;
    const reason = String(body?.reason ?? "").trim() as Reason;
    const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    if (!ACTION_TYPES.includes(action)) return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    if (!REASONS.includes(reason)) return NextResponse.json({ ok: false, error: "Invalid reason" }, { status: 400 });

    let c: Record<string, unknown> | null = null;
    try {
      const withTracking = await admin
        .from("cases")
        .select("id, rerun_count, processing_log")
        .eq("id", caseId)
        .maybeSingle();
      if (!withTracking.error && withTracking.data) {
        c = withTracking.data as Record<string, unknown>;
      }
    } catch {
      // continue to fallback
    }
    if (!c) {
      const fallback = await admin.from("cases").select("id").eq("id", caseId).maybeSingle();
      c = (fallback.data ?? null) as Record<string, unknown> | null;
    }
    if (!c) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    const normalizedAction = normalizeAction(action);

    const { data: latestReport } = await admin
      .from("reports")
      .select("version")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sourceVersion = latestReport?.version ?? null;

    const { data: logRow, error: logErr } = await admin
      .from("audit_rerun_log")
      .insert({
        case_id: caseId,
        action_type: normalizedAction,
        triggered_by: user.id,
        triggered_role: "auditor",
        reason,
        notes,
        source_report_version: sourceVersion,
        target_report_version: null,
        status: "pending",
      })
      .select("id")
      .single();

    if (logErr) return NextResponse.json({ ok: false, error: logErr.message }, { status: 500 });

    const now = new Date().toISOString();
    const existingLog = Array.isArray((c as Record<string, unknown>).processing_log)
      ? ((c as Record<string, unknown>).processing_log as unknown[])
      : [];
    try {
      await admin
        .from("cases")
        .update({
          rerun_count: Number((c as Record<string, unknown>).rerun_count ?? 0) + 1,
          last_rerun_at: now,
          last_rerun_by: user.id,
          processing_log: [
            ...existingLog,
            {
              at: now,
              action: normalizedAction,
              requested_action: action,
              reason,
              rerun_log_id: logRow?.id ?? null,
              by: user.id,
            },
          ],
        })
        .eq("id", caseId);
    } catch {
      // Tracking columns may not exist in older environments.
    }

    await inngest.send({
      name: "auditor/rerun",
      data: {
        caseId,
        action: normalizedAction,
        reason,
        notes,
        triggeredBy: user.id,
        triggeredRole: "auditor",
        rerunLogId: logRow?.id,
        sourceReportVersion: sourceVersion,
      },
    });

    return NextResponse.json({ ok: true, rerunLogId: logRow?.id });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
