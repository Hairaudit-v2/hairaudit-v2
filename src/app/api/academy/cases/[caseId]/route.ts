import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess, requireAcademyStaff } from "@/lib/academy/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { caseId } = await ctx.params;
  const supabase = await createSupabaseAuthServerClient();

  const { data: c, error: cErr } = await supabase.from("training_cases").select("*").eq("id", caseId).maybeSingle();
  if (cErr) {
    return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  }
  if (!c) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const [{ data: uploads }, { data: metrics }, { data: assessments }] = await Promise.all([
    supabase.from("training_case_uploads").select("*").eq("training_case_id", caseId).order("created_at", { ascending: true }),
    supabase.from("training_case_metrics").select("*").eq("training_case_id", caseId).maybeSingle(),
    supabase
      .from("training_case_assessments")
      .select("*")
      .eq("training_case_id", caseId)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    ok: true,
    case: c,
    uploads: uploads ?? [],
    metrics: metrics ?? null,
    assessments: assessments ?? [],
  });
}

type PatchCaseBody = Partial<{
  status: string;
  notes: string | null;
  procedure_type: string | null;
  complexity_level: string | null;
  patient_sex: string | null;
  patient_age_band: string | null;
}>;

export async function PATCH(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { caseId } = await ctx.params;
  let body: PatchCaseBody;
  try {
    body = (await req.json()) as PatchCaseBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { ...body };
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase.from("training_cases").update(patch).eq("id", caseId).select("*").maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, case: data });
}
