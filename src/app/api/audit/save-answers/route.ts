import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireDevRouteAccess } from "@/lib/security/routeGuards";

export async function POST(req: Request) {
  const gate = await requireDevRouteAccess();
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(req.url);
    const caseId = url.searchParams.get("caseId");

    if (!caseId || caseId === "undefined" || caseId === "null") {
      return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const answers = body?.answers;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ ok: false, error: "Missing answers object" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: c, error: caseErr } = await supabase.from("cases").select("id").eq("id", caseId).maybeSingle();

    if (caseErr || !c) {
      return NextResponse.json({ ok: false, error: "Case not found", caseId }, { status: 404 });
    }

    const { data: latestReport, error: repErr } = await supabase
      .from("reports")
      .select("id, version, summary")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (repErr) {
      return NextResponse.json({ ok: false, error: repErr.message }, { status: 500 });
    }

    let reportId = latestReport?.id as string | undefined;
    let version = latestReport?.version as number | undefined;

    if (!reportId) {
      const { data: created, error: insErr } = await supabase
        .from("reports")
        .insert({
          case_id: caseId,
          version: 1,
          pdf_path: "",
          summary: { answers },
        })
        .select("id, version")
        .maybeSingle();

      if (insErr || !created) {
        return NextResponse.json({ ok: false, error: insErr?.message ?? "Insert failed" }, { status: 500 });
      }

      reportId = created.id;
      version = created.version;

      return NextResponse.json({ ok: true, reportId, version });
    }

    const currentSummary = (latestReport?.summary ?? {}) as Record<string, unknown>;
    const nextSummary = {
      ...currentSummary,
      answers,
      updated_at: new Date().toISOString(),
    };

    const { error: updErr } = await supabase.from("reports").update({ summary: nextSummary }).eq("id", reportId);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reportId, version });
  } catch (e: unknown) {
    console.error("save-answers error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
