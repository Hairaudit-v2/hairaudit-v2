import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req: Request) {
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

    const supabase = supabaseAdmin();

    // 1) Ensure case exists (prevents silent bad IDs)
    const { data: c, error: caseErr } = await supabase
      .from("cases")
      .select("id")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr || !c) {
      return NextResponse.json(
        { ok: false, error: "Case not found", caseId },
        { status: 404 }
      );
    }

    // 2) Load latest report for this case
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

    // If no report exists yet, create version 1
    let reportId = latestReport?.id as string | undefined;
    let version = latestReport?.version as number | undefined;

    if (!reportId) {
      const { data: created, error: insErr } = await supabase
        .from("reports")
        .insert({
          case_id: caseId,
          version: 1,
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

    // 3) Update that report summary safely
    const currentSummary = (latestReport?.summary ?? {}) as any;
    const nextSummary = {
      ...currentSummary,
      answers, // overwrite answers with latest form submission
      updated_at: new Date().toISOString(),
    };

    const { error: updErr } = await supabase
      .from("reports")
      .update({ summary: nextSummary })
      .eq("id", reportId);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reportId, version });
  } catch (e: any) {
    console.error("save-answers error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
