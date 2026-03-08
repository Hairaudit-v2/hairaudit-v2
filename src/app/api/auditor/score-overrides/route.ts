import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";

export const runtime = "nodejs";

const REASON_CATEGORIES = [
  "ai_overestimated",
  "ai_underestimated",
  "missing_documentation",
  "image_quality_issue",
  "conflicting_evidence",
  "clinic_contribution_clarified",
  "medical_nuance",
  "benchmark_rule_exception",
  "auditor_judgment",
] as const;

const DOMAIN_KEYS = ["SP", "DP", "GV", "IC", "DI"] as const;

/** GET ?caseId=&reportId= — list overrides for a report */
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
      .from("audit_score_overrides")
      .select("*")
      .eq("case_id", caseId)
      .eq("report_id", reportId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, overrides: rows ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "Server error") }, { status: 500 });
  }
}

/** POST — create or update override */
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
    const domainKey = String(body?.domainKey ?? "").trim();
    const manualScore = Number(body?.manualScore);
    const reasonCategory = String(body?.reasonCategory ?? "").trim();
    const overrideNote = typeof body?.overrideNote === "string" ? body.overrideNote.trim() : null;
    const aiScore = Number(body?.aiScore);
    const aiWeightedScore = body?.aiWeightedScore != null ? Number(body.aiWeightedScore) : null;

    if (!caseId || !reportId || !domainKey) {
      return NextResponse.json({ ok: false, error: "Missing caseId, reportId, or domainKey" }, { status: 400 });
    }
    if (!DOMAIN_KEYS.includes(domainKey as any)) {
      return NextResponse.json({ ok: false, error: "Invalid domainKey" }, { status: 400 });
    }
    if (!Number.isFinite(manualScore) || manualScore < 0 || manualScore > 100) {
      return NextResponse.json({ ok: false, error: "manualScore must be 0-100" }, { status: 400 });
    }
    if (!REASON_CATEGORIES.includes(reasonCategory as any)) {
      return NextResponse.json({ ok: false, error: "Invalid reasonCategory" }, { status: 400 });
    }
    if (!Number.isFinite(aiScore)) {
      return NextResponse.json({ ok: false, error: "aiScore required" }, { status: 400 });
    }

    const deltaScore = Number((manualScore - aiScore).toFixed(2));
    const manualWeightedScore = aiWeightedScore != null ? Math.round(manualScore * (aiWeightedScore / (aiScore || 1))) : null;

    const payload = {
      case_id: caseId,
      report_id: reportId,
      domain_key: domainKey,
      ai_score: aiScore,
      ai_weighted_score: aiWeightedScore,
      manual_score: manualScore,
      manual_weighted_score: Number.isFinite(manualWeightedScore) ? manualWeightedScore : null,
      delta_score: deltaScore,
      reason_category: reasonCategory,
      override_note: overrideNote ?? null,
      created_by: user.id,
    };

    const { error: upsertErr } = await admin
      .from("audit_score_overrides")
      .upsert(payload, { onConflict: "case_id,report_id,domain_key" });

    if (upsertErr) return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "Server error") }, { status: 500 });
  }
}

/** DELETE ?caseId=&reportId=&domainKey= — restore AI score (remove override). Omit domainKey to restore all. */
export async function DELETE(req: Request) {
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
    const domainKey = searchParams.get("domainKey")?.trim();

    if (!caseId || !reportId) {
      return NextResponse.json({ ok: false, error: "Missing caseId or reportId" }, { status: 400 });
    }

    let query = admin
      .from("audit_score_overrides")
      .delete()
      .eq("case_id", caseId)
      .eq("report_id", reportId);
    if (domainKey) query = query.eq("domain_key", domainKey);

    const { error } = await query;

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "Server error") }, { status: 500 });
  }
}
