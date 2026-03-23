import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import {
  AUDITOR_RERUN_ACTION_TYPES,
  AUDITOR_RERUN_REASONS,
  queueAuditorRerunFromAdmin,
  type AuditorRerunAction,
  type AuditorRerunReason,
} from "@/lib/auditor/queueAuditorRerun";
import { isInternalGiiBackfillRequest } from "@/lib/internal/giiBackfillAuth";

export const runtime = "nodejs";

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
      return NextResponse.json({ ok: false, error: "Forbidden: auditors only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId")?.trim();
    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });

    const { data, error } = await admin
      .from("audit_rerun_log")
      .select(
        "id, case_id, action_type, triggered_by, triggered_role, reason, notes, source_report_version, target_report_version, status, error, created_at"
      )
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
    const admin = createSupabaseAdminClient();
    const internalBackfill = isInternalGiiBackfillRequest(req);

    let actingUserId: string;
    if (internalBackfill) {
      const actor = String(process.env.GII_BACKFILL_TRIGGERED_BY ?? "").trim();
      if (!actor) {
        return NextResponse.json(
          { ok: false, error: "Server misconfigured: GII_BACKFILL_TRIGGERED_BY (auth user id for audit_rerun_log)" },
          { status: 500 }
        );
      }
      actingUserId = actor;
    } else {
      const supabase = await createSupabaseAuthServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

      const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
        return NextResponse.json({ ok: false, error: "Forbidden: auditors only" }, { status: 403 });
      }
      actingUserId = user.id;
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const caseId = String(body?.caseId ?? "").trim();
    const action = String(body?.action ?? "").trim() as AuditorRerunAction;
    const reason = String(body?.reason ?? "").trim() as AuditorRerunReason;
    const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    const actions = AUDITOR_RERUN_ACTION_TYPES as readonly string[];
    const reasons = AUDITOR_RERUN_REASONS as readonly string[];
    if (!actions.includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }
    if (!reasons.includes(reason)) {
      return NextResponse.json({ ok: false, error: "Invalid reason" }, { status: 400 });
    }

    const result = await queueAuditorRerunFromAdmin(admin, {
      caseId,
      actingUserId,
      action: action as AuditorRerunAction,
      reason: reason as AuditorRerunReason,
      notes,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.httpStatus });
    }

    return NextResponse.json({ ok: true, rerunLogId: result.rerunLogId });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
