import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import rubric from "@/lib/audit/rubrics/hairaudit_patient_basic_v1.json";
import { buildEmptyAnswers } from "@/lib/audit/template";

console.log("rubric loaded:", rubric?.rubric_id, "domains:", rubric?.domains?.length);

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// GET /api/audit/seed-answers  (health check)
export async function GET() {
  return new NextResponse("seed-answers route is alive", { status: 200 });
}

// POST /api/audit/seed-answers?caseId=...
export async function POST(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? "";
  if (!caseId) return new NextResponse("Missing caseId", { status: 400 });

  const supabase = supabaseAdmin();

  // 1) Confirm case exists (better error message)
  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !c) return NextResponse.json({ ok: false, error: "Case not found", caseId }, { status: 404 });

  // 2) Load latest report (if any)
  const { data: existing, error: repErr } = await supabase
    .from("reports")
    .select("id, summary, version")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (repErr) return new NextResponse(repErr.message, { status: 500 });

  // 3) If no report exists, create v1 report row
  let report = existing;
  if (!report) {
    const { data: created, error: createErr } = await supabase
      .from("reports")
      .insert({
        case_id: caseId,
        version: 1,
        summary: {
          notes: "Seeded answers template",
          rubric: { rubric_id: rubric.rubric_id, version: rubric.version, title: rubric.title }
        }
      })
      .select("id, summary, version")
      .maybeSingle();

    if (createErr || !created) return new NextResponse(createErr?.message ?? "Failed to create report", { status: 500 });
    report = created;
  }

  // 4) Seed answers into report summary (idempotent)
  const summary = (report.summary ?? {}) as any;

  if (!summary.rubric) {
    summary.rubric = { rubric_id: rubric.rubric_id, version: rubric.version, title: rubric.title };
  }

  if (!summary.answers) {
    summary.answers = buildEmptyAnswers(rubric as any);
  }

  const { error: upErr } = await supabase
    .from("reports")
    .update({ summary })
    .eq("id", report.id);

  if (upErr) return new NextResponse(upErr.message, { status: 500 });

  return NextResponse.json({ ok: true, reportId: report.id, version: report.version });
}