import { NextResponse } from "next/server";
import rubric from "@/lib/audit/rubrics/hairaudit_patient_basic_v1.json";
import { buildEmptyAnswers } from "@/lib/audit/template";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireDevRouteAccess } from "@/lib/security/routeGuards";

// GET /api/audit/seed-answers  (health check)
export async function GET() {
  const gate = await requireDevRouteAccess();
  if (!gate.ok) return gate.response;
  return new NextResponse("seed-answers route is alive", { status: 200 });
}

// POST /api/audit/seed-answers?caseId=...
export async function POST(req: Request) {
  const gate = await requireDevRouteAccess();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? "";
  if (!caseId) return new NextResponse("Missing caseId", { status: 400 });

  const supabase = createSupabaseAdminClient();

  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !c) return NextResponse.json({ ok: false, error: "Case not found", caseId }, { status: 404 });

  const { data: existing, error: repErr } = await supabase
    .from("reports")
    .select("id, summary, version")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (repErr) return new NextResponse(repErr.message, { status: 500 });

  let report = existing;
  if (!report) {
    const { data: created, error: createErr } = await supabase
      .from("reports")
      .insert({
        case_id: caseId,
        version: 1,
        pdf_path: "",
        summary: {
          notes: "Seeded answers template",
          rubric: { rubric_id: rubric.rubric_id, version: rubric.version, title: rubric.title },
        },
      })
      .select("id, summary, version")
      .maybeSingle();

    if (createErr || !created) return new NextResponse(createErr?.message ?? "Failed to create report", { status: 500 });
    report = created;
  }

  const summary = (report.summary ?? {}) as Record<string, unknown>;

  if (!summary.rubric) {
    summary.rubric = { rubric_id: rubric.rubric_id, version: rubric.version, title: rubric.title };
  }

  if (!summary.answers) {
    summary.answers = buildEmptyAnswers(rubric as Parameters<typeof buildEmptyAnswers>[0]);
  }

  const { error: upErr } = await supabase.from("reports").update({ summary }).eq("id", report.id);

  if (upErr) return new NextResponse(upErr.message, { status: 500 });

  return NextResponse.json({ ok: true, reportId: report.id, version: report.version });
}
