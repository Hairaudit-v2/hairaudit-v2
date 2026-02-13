import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/case-access";

const AUDITOR_EMAIL = "manager@evolvedhair.com.au";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const caseId = url.searchParams.get("caseId");
    if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

    const supabaseAuth = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = await getUserRole(user.id);
    const isAuditor = role === "auditor" || user.email === AUDITOR_EMAIL;
    if (!isAuditor) return NextResponse.json({ error: "Forbidden: auditors only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { score, notes, findings } = body;
    const scoreNum = typeof score === "number" ? score : score != null ? Number(score) : null;
    const notesStr = typeof notes === "string" ? notes : "";
    const findingsArr = Array.isArray(findings) ? findings : typeof findings === "string" ? [findings] : [];

    const admin = createSupabaseAdminClient();
    const { data: latestReport, error: repErr } = await admin
      .from("reports")
      .select("id, version, summary")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (repErr) return NextResponse.json({ error: repErr.message }, { status: 500 });

    const currentSummary = (latestReport?.summary ?? {}) as Record<string, unknown>;
    const nextSummary = {
      ...currentSummary,
      score: scoreNum,
      notes: notesStr,
      findings: findingsArr,
      manual_audit_draft: true,
      updated_at: new Date().toISOString(),
    };

    if (latestReport) {
      const { error: updErr } = await admin
        .from("reports")
        .update({ summary: nextSummary })
        .eq("id", latestReport.id);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, reportId: latestReport.id });
    }

    const { data: created, error: insErr } = await admin
      .from("reports")
      .insert({ case_id: caseId, version: 1, summary: nextSummary })
      .select("id")
      .maybeSingle();

    if (insErr || !created) return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
    return NextResponse.json({ ok: true, reportId: created.id });
  } catch (e: unknown) {
    console.error("save-manual error:", e);
    return NextResponse.json({ error: (e as Error).message ?? "Server error" }, { status: 500 });
  }
}
